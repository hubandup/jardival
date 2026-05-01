import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCachedPdfCover, renderPdfCover } from "@/lib/pdfCover";

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
 * Utilise le cache partagé `pdfCover` pour éviter le double rendu.
 */
export const PdfCoverImage = ({
  pdfUrl,
  alt,
  className,
  style,
  width = 600,
  onReady,
}: Props) => {
  const [src, setSrc] = useState<string | null>(() => getCachedPdfCover(pdfUrl));
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const cached = getCachedPdfCover(pdfUrl);
    if (cached) {
      setSrc(cached);
      onReady?.(cached);
      return;
    }
    setSrc(null);

    renderPdfCover(pdfUrl, width).then((dataUrl) => {
      if (cancelled.current || !dataUrl) return;
      setSrc(dataUrl);
      onReady?.(dataUrl);
    });

    return () => {
      cancelled.current = true;
    };
  }, [pdfUrl, width, onReady]);

  if (!src) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-muted/60",
          className,
        )}
        style={{
          ...style,
          aspectRatio: "1 / 1.414",
        }}
        aria-label={alt}
        aria-busy="true"
        role="img"
      >
        {/* Shimmer */}
        <div
          className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite]"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.35), transparent)",
          }}
        />
        {/* Icône centrée discrète */}
        <div className="absolute inset-0 flex items-center justify-center">
          <FileText className="h-8 w-8 text-foreground/30" aria-hidden />
        </div>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} style={style} loading="eager" />;
};
