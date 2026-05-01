import { useEffect, useRef, useState } from "react";
import { pdfjs } from "react-pdf";

// Worker (même version que react-pdf)
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// Cache global pour ne pas re-rendre la même page à chaque montage.
const cache = new Map<string, string>();

type Props = {
  pdfUrl: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  /** Largeur cible en pixels pour le rendu canvas (qualité). */
  width?: number;
  onReady?: (dataUrl: string) => void;
};

/**
 * Rend la première page d'un PDF comme image (fallback couverture).
 */
export const PdfCoverImage = ({
  pdfUrl,
  alt,
  className,
  style,
  width = 600,
  onReady,
}: Props) => {
  const [src, setSrc] = useState<string | null>(() => cache.get(pdfUrl) ?? null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const cached = cache.get(pdfUrl);
    if (cached) {
      setSrc(cached);
      onReady?.(cached);
      return;
    }
    setSrc(null);

    (async () => {
      try {
        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = width / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        cache.set(pdfUrl, dataUrl);
        if (!cancelled.current) {
          setSrc(dataUrl);
          onReady?.(dataUrl);
        }
      } catch (err) {
        console.warn("[PdfCoverImage] Échec rendu 1re page", err);
      }
    })();

    return () => {
      cancelled.current = true;
    };
  }, [pdfUrl, width, onReady]);

  if (!src) {
    return (
      <div
        className={className}
        style={{
          ...style,
          background: "hsl(var(--muted))",
          aspectRatio: "1 / 1.414",
        }}
        aria-label={alt}
        role="img"
      />
    );
  }

  return <img src={src} alt={alt} className={className} style={style} loading="eager" />;
};
