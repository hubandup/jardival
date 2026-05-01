// Rend une page d'un PDF, crope une bounding box (format Gemini : [ymin, xmin, ymax, xmax]
// normalisé 0-1000) et upload l'image dans le bucket Supabase `promo-images`.
import * as pdfjsLib from "pdfjs-dist";
import { supabase } from "@/integrations/supabase/client";
import type { Bbox } from "@/types/catalogue";

// Worker pdfjs (déjà utilisé ailleurs dans le projet via react-pdf)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface CropTask {
  pageNumber: number;
  bbox: Bbox;
  filename: string; // nom de fichier souhaité (sans extension)
}

interface CropResult {
  filename: string;
  publicUrl: string | null;
  error?: string;
}

export interface CropOptions {
  scale?: number; // 1..4, défaut 2
  format?: "jpeg" | "png"; // défaut jpeg
  quality?: number; // 0..1, défaut 0.92 (jpeg uniquement)
}

// Cache du PDF chargé (évite de re-fetch pour chaque page)
let cachedPdfUrl: string | null = null;
let cachedPdfDoc: pdfjsLib.PDFDocumentProxy | null = null;

export async function loadPdf(pdfUrl: string) {
  if (cachedPdfUrl === pdfUrl && cachedPdfDoc) return cachedPdfDoc;
  const loadingTask = pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false });
  cachedPdfDoc = await loadingTask.promise;
  cachedPdfUrl = pdfUrl;
  return cachedPdfDoc;
}

// Rend une page entière en canvas (résolution suffisante pour les crops)
export async function renderPage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale = 2
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// Crope une zone (en coordonnées 0-1000) et retourne un blob (jpeg ou png)
function cropToBlob(
  pageCanvas: HTMLCanvasElement,
  bbox: Bbox,
  format: "jpeg" | "png",
  quality: number
): Promise<Blob | null> {
  const [ymin, xmin, ymax, xmax] = bbox;
  const y1 = Math.max(0, Math.min(1000, ymin));
  const x1 = Math.max(0, Math.min(1000, xmin));
  const y2 = Math.max(0, Math.min(1000, ymax));
  const x2 = Math.max(0, Math.min(1000, xmax));
  if (y2 <= y1 + 5 || x2 <= x1 + 5) return Promise.resolve(null);

  const sx = Math.floor((x1 / 1000) * pageCanvas.width);
  const sy = Math.floor((y1 / 1000) * pageCanvas.height);
  const sw = Math.ceil(((x2 - x1) / 1000) * pageCanvas.width);
  const sh = Math.ceil(((y2 - y1) / 1000) * pageCanvas.height);

  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(pageCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  return new Promise((resolve) => {
    if (format === "png") {
      out.toBlob((b) => resolve(b), "image/png");
    } else {
      out.toBlob((b) => resolve(b), "image/jpeg", quality);
    }
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "promo";
}

export async function cropAndUploadPromoImages(
  pdfUrl: string,
  tasks: CropTask[],
  onProgress?: (done: number, total: number) => void,
  options: CropOptions = {}
): Promise<CropResult[]> {
  const scale = Math.max(1, Math.min(4, options.scale ?? 2));
  const format = options.format ?? "jpeg";
  const quality = options.quality ?? 0.92;
  const ext = format === "png" ? "png" : "jpg";
  const contentType = format === "png" ? "image/png" : "image/jpeg";

  const pdf = await loadPdf(pdfUrl);

  const byPage = new Map<number, CropTask[]>();
  for (const t of tasks) {
    if (!byPage.has(t.pageNumber)) byPage.set(t.pageNumber, []);
    byPage.get(t.pageNumber)!.push(t);
  }

  const results: CropResult[] = [];
  let done = 0;
  const total = tasks.length;

  for (const [pageNumber, pageTasks] of byPage) {
    let pageCanvas: HTMLCanvasElement | null = null;
    try {
      pageCanvas = await renderPage(pdf, pageNumber, scale);
    } catch (e) {
      console.error(`Render page ${pageNumber} failed`, e);
      for (const t of pageTasks) {
        results.push({ filename: t.filename, publicUrl: null, error: "Rendu page échoué" });
        done++;
        onProgress?.(done, total);
      }
      continue;
    }

    for (const t of pageTasks) {
      try {
        const blob = await cropToBlob(pageCanvas, t.bbox, format, quality);
        if (!blob) {
          results.push({ filename: t.filename, publicUrl: null, error: "Bbox invalide" });
        } else {
          const path = `extracted/${Date.now()}-${slugify(t.filename)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("promo-images")
            .upload(path, blob, { contentType, upsert: false });
          if (upErr) {
            console.error("Upload error", upErr);
            results.push({ filename: t.filename, publicUrl: null, error: upErr.message });
          } else {
            const { data } = supabase.storage.from("promo-images").getPublicUrl(path);
            results.push({ filename: t.filename, publicUrl: data.publicUrl });
          }
        }
      } catch (e) {
        console.error("Crop/upload error", e);
        results.push({
          filename: t.filename,
          publicUrl: null,
          error: e instanceof Error ? e.message : "Erreur",
        });
      }
      done++;
      onProgress?.(done, total);
    }
  }

  return results;
}

export function clearPdfCache() {
  cachedPdfDoc = null;
  cachedPdfUrl = null;
}

/**
 * Analyse les pixels d'une bbox pour déterminer si son contenu non-blanc
 * est concentré sur une bande de bord ≤ `edgeFraction` (5% par défaut).
 */
function analyseBboxEdges(
  pageCanvas: HTMLCanvasElement,
  bbox: Bbox,
  edgeFraction = 0.05
): { isEdgeOnly: boolean; totalNonWhiteRatio: number; innerShare: number } {
  const [ymin, xmin, ymax, xmax] = bbox;
  const sx = Math.max(0, Math.floor((xmin / 1000) * pageCanvas.width));
  const sy = Math.max(0, Math.floor((ymin / 1000) * pageCanvas.height));
  const sw = Math.max(1, Math.ceil(((xmax - xmin) / 1000) * pageCanvas.width));
  const sh = Math.max(1, Math.ceil(((ymax - ymin) / 1000) * pageCanvas.height));

  const ctx = pageCanvas.getContext("2d");
  if (!ctx) return { isEdgeOnly: false, totalNonWhiteRatio: 1, innerShare: 1 };

  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(sx, sy, sw, sh);
  } catch {
    return { isEdgeOnly: false, totalNonWhiteRatio: 1, innerShare: 1 };
  }
  const data = imgData.data;

  const step = Math.max(1, Math.floor(Math.min(sw, sh) / 80));
  const innerXmin = Math.floor(sw * edgeFraction);
  const innerXmax = sw - innerXmin;
  const innerYmin = Math.floor(sh * edgeFraction);
  const innerYmax = sh - innerYmin;

  let total = 0;
  let nonWhiteTotal = 0;
  let nonWhiteInner = 0;

  for (let y = 0; y < sh; y += step) {
    for (let x = 0; x < sw; x += step) {
      const i = (y * sw + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const isNonWhite = r < 240 || g < 240 || b < 240;
      total++;
      if (isNonWhite) {
        nonWhiteTotal++;
        if (x >= innerXmin && x < innerXmax && y >= innerYmin && y < innerYmax) {
          nonWhiteInner++;
        }
      }
    }
  }

  const totalNonWhiteRatio = total > 0 ? nonWhiteTotal / total : 0;
  const innerShare = nonWhiteTotal > 0 ? nonWhiteInner / nonWhiteTotal : 1;

  // La bbox est "vide à l'intérieur" : très peu de contenu non-blanc,
  // et ce contenu est presque exclusivement collé aux bords.
  const isEdgeOnly =
    nonWhiteTotal > 0 && totalNonWhiteRatio < 0.05 && innerShare < 0.15;

  return { isEdgeOnly, totalNonWhiteRatio, innerShare };
}

/**
 * Pour une liste de bboxes, retourne les indices dont la zone ne contient
 * qu'un fragment d'image en bord (< 5%). Ces zones doivent être supprimées.
 */
export async function detectEdgeOnlyBboxes(
  pdfUrl: string,
  items: Array<{ pageNumber: number; bbox: Bbox }>
): Promise<number[]> {
  if (!items.length) return [];
  const pdf = await loadPdf(pdfUrl);
  const byPage = new Map<number, number[]>();
  items.forEach((it, idx) => {
    if (!byPage.has(it.pageNumber)) byPage.set(it.pageNumber, []);
    byPage.get(it.pageNumber)!.push(idx);
  });

  const toDrop: number[] = [];
  for (const [pageNumber, idxs] of byPage) {
    let pageCanvas: HTMLCanvasElement;
    try {
      pageCanvas = await renderPage(pdf, pageNumber, 1.5);
    } catch (e) {
      console.warn(`Render page ${pageNumber} skipped`, e);
      continue;
    }
    for (const idx of idxs) {
      try {
        const r = analyseBboxEdges(pageCanvas, items[idx].bbox, 0.05);
        if (r.isEdgeOnly) toDrop.push(idx);
      } catch (e) {
        console.warn("analyseBboxEdges error", e);
      }
    }
  }
  return toDrop;
}
