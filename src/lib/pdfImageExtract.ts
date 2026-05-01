// Extraction des images NATIVES embarquées dans un PDF (par opposition à un crop
// d'une page rasterisée). Utilise pdfjs-dist pour parcourir la liste d'opérateurs
// de chaque page et localiser les paintImageXObject / paintInlineImage avec leur
// matrice de transformation courante (CTM), puis extraire l'image dans sa qualité
// d'origine.
//
// Convention de coordonnées : retournées en repère TOP-LEFT (PDF natif = bottom-left,
// converti pour s'aligner avec le rendu écran), en unités PDF de la page.
import * as pdfjsLib from "pdfjs-dist";
import { loadPdf } from "@/lib/pdfImageCrop";

export interface NativePageImage {
  pageNumber: number;
  /** Position top-left X dans le repère PDF de la page (unités PDF). */
  x: number;
  /** Position top-left Y dans le repère PDF de la page (unités PDF). */
  y: number;
  /** Largeur dessinée sur la page (unités PDF, valeur absolue). */
  width: number;
  /** Hauteur dessinée sur la page (unités PDF, valeur absolue). */
  height: number;
  /** Largeur native du bitmap (pixels). */
  naturalWidth: number;
  /** Hauteur native du bitmap (pixels). */
  naturalHeight: number;
  /** L'image originale, encodée en JPEG (qualité 0.92). */
  blob: Blob;
  /** Identifiant interne pdfjs (utile pour dédupliquer les répétitions). */
  objId: string | null;
  /** Source : 'xobject' (référence partagée) ou 'inline' (image inline). */
  source: "xobject" | "inline";
}

export interface ExtractNativeImagesResult {
  images: NativePageImage[];
  /** Dimensions de chaque page en unités PDF (utilisées par le matcher position→image). */
  pageDimensions: Record<number, { width: number; height: number }>;
  /** Comptes par page pour diagnostic ("combien d'images natives par page"). */
  countsByPage: Record<number, number>;
  /** Pages où aucune image n'a été trouvée (signal pour activer le fallback). */
  emptyPages: number[];
  /** true si aucune image n'a pu être extraite — caller doit fallback rasterize+crop. */
  shouldFallback: boolean;
  /** true si l'extraction globale a dépassé le timeout (extraction partielle). */
  timedOut: boolean;
  /** Nombre d'images skippées à cause du per-image timeout (XObjects pathologiques). */
  perImageTimeouts: number;
}

// =============================================
// Helpers matrice 3x3 (homogène) pour CTM
// =============================================
type Mat6 = [number, number, number, number, number, number]; // [a, b, c, d, e, f]
const IDENTITY: Mat6 = [1, 0, 0, 1, 0, 0];

function mulMat(m1: Mat6, m2: Mat6): Mat6 {
  // PDF concat : new = m2 * m1 ; on utilise la convention pdfjs (transform op = m * ctm).
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2,
  ];
}

function applyMat(m: Mat6, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

// =============================================
// Rendu d'une image pdfjs (XObject ou inline) en Blob JPEG
// =============================================
async function imageToBlob(
  img: { bitmap?: ImageBitmap | null; data?: Uint8ClampedArray | Uint8Array; width: number; height: number; kind?: number }
): Promise<Blob | null> {
  if (!img || !img.width || !img.height) return null;
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
  } else if (img.data) {
    // pdfjs encode les images RGBA dans data quand kind === 1, RGB quand kind === 3.
    // Pour rester simple, on couvre le cas RGBA (kind 1) et la conversion RGB → RGBA si besoin.
    const data = img.data;
    let rgba: Uint8ClampedArray;
    if (data.length === w * h * 4) {
      rgba = data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data);
    } else if (data.length === w * h * 3) {
      rgba = new Uint8ClampedArray(w * h * 4);
      for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
        rgba[j] = data[i];
        rgba[j + 1] = data[i + 1];
        rgba[j + 2] = data[i + 2];
        rgba[j + 3] = 255;
      }
    } else {
      // Format inconnu : on tente quand même.
      rgba = new Uint8ClampedArray(data.buffer ?? data);
    }
    const imgData = new ImageData(rgba, w, h);
    ctx.putImageData(imgData, 0, 0);
  } else {
    return null;
  }

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
  });
}

// =============================================
// Récupère l'image d'un objId pdfjs en attendant sa résolution si besoin.
// =============================================
function fetchObj(page: pdfjsLib.PDFPageProxy, objId: string): Promise<unknown> {
  const objs = (page as unknown as { objs: { has: (id: string) => boolean; get: (id: string, cb?: (v: unknown) => void) => unknown } }).objs;
  if (objs.has(objId)) return Promise.resolve(objs.get(objId));
  return new Promise((resolve) => objs.get(objId, resolve));
}

// Wraps fetchObj with a per-image timeout. Certains XObjects (JBIG2, JPX,
// color-managed) ne se résolvent jamais avec le worker pdfjs en mode browser,
// ce qui bloque la pipeline entière. Mieux vaut skipper cette image.
function fetchObjWithTimeout(
  page: pdfjsLib.PDFPageProxy,
  objId: string,
  timeoutMs: number
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const t = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`per-image timeout (${timeoutMs}ms) for objId=${objId}`));
    }, timeoutMs);
    fetchObj(page, objId).then(
      (v) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(t);
        reject(e);
      }
    );
  });
}

const PER_IMAGE_TIMEOUT_MS = 5_000;
const GLOBAL_TIMEOUT_MS = 30_000;

// =============================================
// Extraction principale
// =============================================
export async function extractNativeImages(
  pdfUrl: string,
  options: { maxImagesPerPage?: number } = {}
): Promise<ExtractNativeImagesResult> {
  const maxPerPage = options.maxImagesPerPage ?? 200; // garde-fou contre PDF pathologiques
  const pdf = await loadPdf(pdfUrl);

  const OPS = pdfjsLib.OPS;
  const images: NativePageImage[] = [];
  const countsByPage: Record<number, number> = {};
  const emptyPages: number[] = [];
  const pageDimensions: Record<number, { width: number; height: number }> = {};
  const startedAt = Date.now();
  let timedOut = false;
  let perImageTimeouts = 0;
  const isGloballyTimedOut = () => Date.now() - startedAt > GLOBAL_TIMEOUT_MS;

  pageLoop: for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    if (isGloballyTimedOut()) {
      timedOut = true;
      console.warn(
        `[pdfImageExtract] timeout global (${GLOBAL_TIMEOUT_MS}ms) atteint avant la page ${pageNumber}, retour partiel`
      );
      break;
    }
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    pageDimensions[pageNumber] = { width: viewport.width, height: viewport.height };

    let opList;
    try {
      opList = await page.getOperatorList();
    } catch (e) {
      console.warn(`[pdfImageExtract] page ${pageNumber} : getOperatorList échoué`, e);
      countsByPage[pageNumber] = 0;
      emptyPages.push(pageNumber);
      continue;
    }

    const fnArray = opList.fnArray;
    const argsArray = opList.argsArray;
    const ctmStack: Mat6[] = [];
    let ctm: Mat6 = [...IDENTITY] as Mat6;
    let pageImageCount = 0;
    const seenObjIds = new Set<string>(); // évite de ré-extraire le même XObject plusieurs fois pour la même page

    for (let i = 0; i < fnArray.length && pageImageCount < maxPerPage; i++) {
      if (isGloballyTimedOut()) {
        timedOut = true;
        console.warn(
          `[pdfImageExtract] timeout global (${GLOBAL_TIMEOUT_MS}ms) atteint sur page ${pageNumber} (op ${i}/${fnArray.length}), retour partiel`
        );
        countsByPage[pageNumber] = pageImageCount;
        if (pageImageCount === 0) emptyPages.push(pageNumber);
        break pageLoop;
      }
      const op = fnArray[i];
      const args = argsArray[i];

      if (op === OPS.save) {
        ctmStack.push([...ctm] as Mat6);
      } else if (op === OPS.restore) {
        const popped = ctmStack.pop();
        if (popped) ctm = popped;
      } else if (op === OPS.transform) {
        const m: Mat6 = [args[0], args[1], args[2], args[3], args[4], args[5]];
        ctm = mulMat(m, ctm);
      } else if (op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject) {
        const isXObject = op === OPS.paintImageXObject;
        const objId: string | null = isXObject ? (args?.[0] as string) ?? null : null;
        const dedupKey = isXObject && objId ? `${pageNumber}::${objId}` : null;
        if (dedupKey && seenObjIds.has(dedupKey)) {
          // Image déjà extraite pour cette page (ex: logo répété). On ignore les doublons.
          continue;
        }
        if (dedupKey) seenObjIds.add(dedupKey);

        // Calcule la position sur la page : 4 coins de la unit-square après CTM,
        // puis bounding box axis-aligned (gère les rotations / flips).
        const corners: Array<[number, number]> = [
          applyMat(ctm, 0, 0),
          applyMat(ctm, 1, 0),
          applyMat(ctm, 1, 1),
          applyMat(ctm, 0, 1),
        ];
        const xs = corners.map((c) => c[0]);
        const ys = corners.map((c) => c[1]);
        const xMin = Math.min(...xs);
        const xMax = Math.max(...xs);
        const yMinPdf = Math.min(...ys);
        const yMaxPdf = Math.max(...ys);

        // PDF y est bottom-left → on convertit en top-left.
        const widthPx = xMax - xMin;
        const heightPx = yMaxPdf - yMinPdf;
        const xTop = xMin;
        const yTop = pageHeight - yMaxPdf;

        // Skip les images dégénérées (bbox vide ou < 5 pt).
        if (widthPx < 5 || heightPx < 5) continue;

        // Récupère le bitmap, avec timeout par image (5s) pour skipper les
        // XObjects pathologiques (JBIG2 / JPX / color-managed) qui peuvent
        // bloquer la promise indéfiniment.
        let imgObj: unknown = null;
        try {
          if (isXObject && objId) {
            imgObj = await fetchObjWithTimeout(page, objId, PER_IMAGE_TIMEOUT_MS);
          } else {
            // Inline image : args[0] contient { width, height, data, kind, ... } directement.
            imgObj = args?.[0] ?? null;
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("per-image timeout")) {
            perImageTimeouts++;
            console.warn(
              `[pdfImageExtract] page ${pageNumber} : skip objId=${objId} (timeout ${PER_IMAGE_TIMEOUT_MS}ms)`
            );
          } else {
            console.warn(
              `[pdfImageExtract] page ${pageNumber} : récupération image ${objId ?? "(inline)"} échouée`,
              e
            );
          }
          continue;
        }

        if (!imgObj || typeof imgObj !== "object") continue;
        const img = imgObj as {
          bitmap?: ImageBitmap | null;
          data?: Uint8ClampedArray | Uint8Array;
          width?: number;
          height?: number;
          kind?: number;
        };
        if (!img.width || !img.height) continue;

        const blob = await imageToBlob({
          bitmap: img.bitmap ?? null,
          data: img.data,
          width: img.width,
          height: img.height,
          kind: img.kind,
        });
        if (!blob) continue;

        images.push({
          pageNumber,
          x: xTop,
          y: yTop,
          width: widthPx,
          height: heightPx,
          naturalWidth: img.width,
          naturalHeight: img.height,
          blob,
          objId,
          source: isXObject ? "xobject" : "inline",
        });
        pageImageCount++;
      }
      // OPS.paintImageXObjectRepeat / paintImageMaskXObject* : non gérés ici, peu utiles pour
      // un catalogue produit (motifs répétés / masques alpha) — fallback rasterize couvrira.
    }

    countsByPage[pageNumber] = pageImageCount;
    if (pageImageCount === 0) emptyPages.push(pageNumber);
  }

  // shouldFallback est vrai si :
  //   - aucune image n'a été extraite (PDF entièrement rasterisé), OU
  //   - le timeout global a été atteint (extraction partielle → on complète au crop).
  const shouldFallback = images.length === 0 || timedOut;

  // Diagnostic : utile pour l'instrumentation pendant les tests sur PDF réels.
  console.info("[pdfImageExtract] résumé", {
    totalImages: images.length,
    countsByPage,
    emptyPages,
    shouldFallback,
    timedOut,
    perImageTimeouts,
    durationMs: Date.now() - startedAt,
  });

  return {
    images,
    pageDimensions,
    countsByPage,
    emptyPages,
    shouldFallback,
    timedOut,
    perImageTimeouts,
  };
}
