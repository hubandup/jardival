// Rend une page d'un PDF, crope une bounding box (format Gemini : [ymin, xmin, ymax, xmax]
// normalisé 0-1000) et upload l'image dans le bucket Supabase `promo-images`.
import * as pdfjsLib from "pdfjs-dist";
import { supabase } from "@/integrations/supabase/client";

// Worker pdfjs (déjà utilisé ailleurs dans le projet via react-pdf)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export type Bbox = [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0..1000

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

// Cache du PDF chargé (évite de re-fetch pour chaque page)
let cachedPdfUrl: string | null = null;
let cachedPdfDoc: pdfjsLib.PDFDocumentProxy | null = null;

async function loadPdf(pdfUrl: string) {
  if (cachedPdfUrl === pdfUrl && cachedPdfDoc) return cachedPdfDoc;
  const loadingTask = pdfjsLib.getDocument({ url: pdfUrl, withCredentials: false });
  cachedPdfDoc = await loadingTask.promise;
  cachedPdfUrl = pdfUrl;
  return cachedPdfDoc;
}

// Rend une page entière en canvas (résolution suffisante pour les crops)
async function renderPage(
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

// Crope une zone (en coordonnées 0-1000) et retourne un blob PNG
function cropToBlob(pageCanvas: HTMLCanvasElement, bbox: Bbox): Promise<Blob | null> {
  const [ymin, xmin, ymax, xmax] = bbox;
  // Garde-fous : valeurs dans [0..1000] et bbox d'aire raisonnable
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
  ctx.drawImage(pageCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  return new Promise((resolve) => {
    out.toBlob((b) => resolve(b), "image/jpeg", 0.88);
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
  onProgress?: (done: number, total: number) => void
): Promise<CropResult[]> {
  const pdf = await loadPdf(pdfUrl);

  // Groupe par page pour ne rendre chaque page qu'une fois
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
      pageCanvas = await renderPage(pdf, pageNumber, 2);
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
        const blob = await cropToBlob(pageCanvas, t.bbox);
        if (!blob) {
          results.push({ filename: t.filename, publicUrl: null, error: "Bbox invalide" });
        } else {
          const path = `extracted/${Date.now()}-${slugify(t.filename)}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("promo-images")
            .upload(path, blob, { contentType: "image/jpeg", upsert: false });
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
