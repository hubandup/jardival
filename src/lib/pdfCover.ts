// Rendu de la 1re page d'un PDF en data URL JPEG, avec cache global partagé
// entre tous les composants (PdfCoverImage, CatalogueBanner, etc.).
import { pdfjs } from "react-pdf";

if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export function getCachedPdfCover(pdfUrl: string | null | undefined): string | null {
  if (!pdfUrl) return null;
  return cache.get(pdfUrl) ?? null;
}

export function setCachedPdfCover(pdfUrl: string, dataUrl: string) {
  cache.set(pdfUrl, dataUrl);
}

export async function renderPdfCover(
  pdfUrl: string,
  width = 600,
): Promise<string | null> {
  const cached = cache.get(pdfUrl);
  if (cached) return cached;
  const existing = inflight.get(pdfUrl);
  if (existing) return existing;

  const task = (async () => {
    try {
      const pdf = await pdfjs.getDocument(pdfUrl).promise;
      const page = await pdf.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = width / baseViewport.width;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      cache.set(pdfUrl, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn("[pdfCover] Échec rendu 1re page", err);
      return null;
    } finally {
      inflight.delete(pdfUrl);
    }
  })();

  inflight.set(pdfUrl, task);
  return task;
}
