// Aperçu des pages PDF avec bounding boxes superposées (SVG en overlay).
// Permet de valider visuellement la détection IA avant import.
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadPdf, renderPage, type Bbox } from "@/lib/pdfImageCrop";

export interface PreviewBox {
  pageNumber: number;
  bbox: Bbox; // [ymin, xmin, ymax, xmax] 0..1000
  index: number; // index de la promo dans la liste (1-based pour l'affichage)
  label: string;
  selected: boolean;
}

interface Props {
  pdfUrl: string;
  boxes: PreviewBox[];
  onToggleBox?: (index: number) => void;
}

export default function CataloguePromoBboxPreview({ pdfUrl, boxes, onToggleBox }: Props) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const pages = useMemo(() => {
    const set = new Set<number>();
    for (const b of boxes) if (b.pageNumber) set.add(b.pageNumber);
    return Array.from(set).sort((a, b) => a - b);
  }, [boxes]);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pdf = await loadPdf(pdfUrl);
        const next: Record<number, string> = {};
        for (const pageNumber of pages) {
          if (cancelled) return;
          if (pageImages[pageNumber]) {
            next[pageNumber] = pageImages[pageNumber];
            continue;
          }
          const canvas = await renderPage(pdf, pageNumber, 1.4);
          next[pageNumber] = canvas.toDataURL("image/jpeg", 0.85);
        }
        if (!cancelled) setPageImages(next);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur de rendu");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, pdfUrl, pages.join(",")]);

  if (!boxes.some((b) => b.bbox && b.pageNumber)) return null;

  return (
    <div className="border rounded-md">
      <div className="flex items-center justify-between p-3">
        <div>
          <p className="text-sm font-medium">Aperçu visuel</p>
          <p className="text-xs text-muted-foreground">
            {boxes.length} zone{boxes.length > 1 ? "s" : ""} détectée
            {boxes.length > 1 ? "s" : ""} sur {pages.length} page{pages.length > 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShow((s) => !s)}>
          {show ? (
            <>
              <EyeOff className="h-4 w-4" /> Masquer
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" /> Afficher l'aperçu
            </>
          )}
        </Button>
      </div>

      {show && (
        <div className="border-t p-3 space-y-4 max-h-[60vh] overflow-y-auto bg-muted/30">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Rendu des pages…
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading &&
            !error &&
            pages.map((pageNumber) => {
              const src = pageImages[pageNumber];
              const pageBoxes = boxes.filter((b) => b.pageNumber === pageNumber);
              return (
                <PageWithBoxes
                  key={pageNumber}
                  pageNumber={pageNumber}
                  src={src}
                  boxes={pageBoxes}
                  onToggleBox={onToggleBox}
                />
              );
            })}
        </div>
      )}
    </div>
  );
}

function PageWithBoxes({
  pageNumber,
  src,
  boxes,
  onToggleBox,
}: {
  pageNumber: number;
  src?: string;
  boxes: PreviewBox[];
  onToggleBox?: (index: number) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);

  if (!src) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium">Page {pageNumber}</p>
      <div className="relative inline-block w-full bg-background border rounded shadow-sm">
        <img
          ref={imgRef}
          src={src}
          alt={`Page ${pageNumber}`}
          className="w-full h-auto block rounded"
        />
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
        >
          {boxes.map((b) => {
            const [ymin, xmin, ymax, xmax] = b.bbox;
            const w = Math.max(0, xmax - xmin);
            const h = Math.max(0, ymax - ymin);
            const stroke = b.selected
              ? "hsl(var(--primary))"
              : "hsl(var(--muted-foreground))";
            const fill = b.selected
              ? "hsl(var(--primary) / 0.12)"
              : "hsl(var(--muted-foreground) / 0.08)";
            return (
              <g
                key={b.index}
                style={{ pointerEvents: onToggleBox ? "auto" : "none", cursor: onToggleBox ? "pointer" : "default" }}
                onClick={() => onToggleBox?.(b.index - 1)}
              >
                <title>{b.label}</title>
                <rect
                  x={xmin}
                  y={ymin}
                  width={w}
                  height={h}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                />
                <rect
                  x={xmin}
                  y={Math.max(0, ymin - 22)}
                  width={Math.min(60, Math.max(28, String(b.index).length * 14))}
                  height={22}
                  fill={stroke}
                />
                <text
                  x={xmin + 6}
                  y={Math.max(16, ymin - 6)}
                  fontSize={16}
                  fontWeight={700}
                  fill="hsl(var(--primary-foreground))"
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  #{b.index}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
