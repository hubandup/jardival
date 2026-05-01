// Éditeur visuel des bounding boxes sur le PDF.
// Permet de : déplacer, redimensionner, supprimer, ajouter une zone,
// et de voir le texte (titre/prix) associé à chaque sélection pour vérifier la cohérence.
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Loader2, Eye, EyeOff, Trash2, Plus, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadPdf, renderPage, type Bbox } from "@/lib/pdfImageCrop";

export interface PreviewBox {
  pageNumber: number;
  bbox: Bbox; // [ymin, xmin, ymax, xmax] 0..1000
  index: number; // index humain (1-based)
  label: string; // titre
  subLabel?: string; // ex. "12,90 € · au lieu de 19,90 €"
  selected: boolean;
  price?: number | null;
  originalPrice?: number | null;
  description?: string | null;
}

export interface PreviewTextPatch {
  title?: string;
  price?: number | null;
  original_price?: number | null;
  description?: string | null;
}

interface Props {
  pdfUrl: string;
  boxes: PreviewBox[];
  onToggleBox?: (i: number) => void; // i = index 0-based (boxIndex - 1)
  onDeleteBox?: (i: number) => void;
  onUpdateBbox?: (i: number, bbox: Bbox) => void;
  onAddBox?: (pageNumber: number, bbox: Bbox) => void;
  onUpdateText?: (i: number, patch: PreviewTextPatch) => void;
}

type DragState =
  | null
  | {
      mode: "move" | "resize";
      i: number; // index 0-based de la promo
      handle?: "nw" | "ne" | "sw" | "se";
      startX: number;
      startY: number;
      startBbox: Bbox;
    }
  | {
      mode: "create";
      pageNumber: number;
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    };

export default function CataloguePromoBboxPreview({
  pdfUrl,
  boxes,
  onToggleBox,
  onDeleteBox,
  onUpdateBbox,
  onAddBox,
  onUpdateText,
}: Props) {
  const [show, setShow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Pages présentes dans les bboxes OU pages dans lesquelles on veut ajouter (toutes les pages connues).
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
        const next: Record<number, string> = { ...pageImages };
        for (const pageNumber of pages) {
          if (cancelled) return;
          if (next[pageNumber]) continue;
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

  if (!boxes.length) return null;

  return (
    <div className="border rounded-md">
      <div className="flex items-center justify-between p-3 gap-2 flex-wrap">
        <div>
          <p className="text-sm font-medium">Aperçu visuel & édition</p>
          <p className="text-xs text-muted-foreground">
            {boxes.length} zone{boxes.length > 1 ? "s" : ""} · {pages.length} page
            {pages.length > 1 ? "s" : ""}
            {show && " — déplace, redimensionne ou ajoute une zone directement sur la page"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {show && onAddBox && (
            <Button
              variant={creating ? "default" : "outline"}
              size="sm"
              onClick={() => setCreating((c) => !c)}
              title="Cliquer-glisser sur une page pour dessiner une nouvelle zone"
            >
              {creating ? <MousePointer2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {creating ? "Mode dessin actif" : "Ajouter une zone"}
            </Button>
          )}
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
      </div>

      {show && (
        <div className="border-t p-3 space-y-4 max-h-[70vh] overflow-y-auto bg-muted/30">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Rendu des pages…
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error &&
            pages.map((pageNumber) => {
              const src = pageImages[pageNumber];
              const pageBoxes = boxes.filter((b) => b.pageNumber === pageNumber);
              return (
                <PageEditor
                  key={pageNumber}
                  pageNumber={pageNumber}
                  src={src}
                  boxes={pageBoxes}
                  creating={creating}
                  onToggleBox={onToggleBox}
                  onDeleteBox={onDeleteBox}
                  onUpdateBbox={onUpdateBbox}
                  onAddBox={
                    onAddBox
                      ? (bb) => {
                          onAddBox(pageNumber, bb);
                          setCreating(false);
                        }
                      : undefined
                  }
                />
              );
            })}
        </div>
      )}
    </div>
  );
}

function clamp01k(v: number) {
  return Math.max(0, Math.min(1000, v));
}

function PageEditor({
  pageNumber,
  src,
  boxes,
  creating,
  onToggleBox,
  onDeleteBox,
  onUpdateBbox,
  onAddBox,
}: {
  pageNumber: number;
  src?: string;
  boxes: PreviewBox[];
  creating: boolean;
  onToggleBox?: (i: number) => void;
  onDeleteBox?: (i: number) => void;
  onUpdateBbox?: (i: number, bbox: Bbox) => void;
  onAddBox?: (bbox: Bbox) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: clamp01k(((clientX - rect.left) / rect.width) * 1000),
      y: clamp01k(((clientY - rect.top) / rect.height) * 1000),
    };
  }, []);

  // Mouse move / up global pendant un drag
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const { x, y } = toLocal(e.clientX, e.clientY);
      if (drag.mode === "create") {
        setDrag({ ...drag, currentX: x, currentY: y });
      } else if (drag.mode === "move") {
        const dx = x - drag.startX;
        const dy = y - drag.startY;
        const [ymin, xmin, ymax, xmax] = drag.startBbox;
        const w = xmax - xmin;
        const h = ymax - ymin;
        let nxmin = clamp01k(xmin + dx);
        let nymin = clamp01k(ymin + dy);
        if (nxmin + w > 1000) nxmin = 1000 - w;
        if (nymin + h > 1000) nymin = 1000 - h;
        onUpdateBbox?.(drag.i, [nymin, nxmin, nymin + h, nxmin + w]);
      } else if (drag.mode === "resize") {
        let [ymin, xmin, ymax, xmax] = drag.startBbox;
        if (drag.handle === "nw") {
          ymin = clamp01k(y);
          xmin = clamp01k(x);
        } else if (drag.handle === "ne") {
          ymin = clamp01k(y);
          xmax = clamp01k(x);
        } else if (drag.handle === "sw") {
          ymax = clamp01k(y);
          xmin = clamp01k(x);
        } else if (drag.handle === "se") {
          ymax = clamp01k(y);
          xmax = clamp01k(x);
        }
        // Évite l'inversion : minimum 20 unités
        if (xmax - xmin < 20 || ymax - ymin < 20) return;
        onUpdateBbox?.(drag.i, [ymin, xmin, ymax, xmax]);
      }
    };
    const onUp = () => {
      if (drag.mode === "create") {
        const x1 = Math.min(drag.startX, drag.currentX);
        const y1 = Math.min(drag.startY, drag.currentY);
        const x2 = Math.max(drag.startX, drag.currentX);
        const y2 = Math.max(drag.startY, drag.currentY);
        if (x2 - x1 > 20 && y2 - y1 > 20) {
          onAddBox?.([y1, x1, y2, x2]);
        }
      }
      setDrag(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, toLocal, onUpdateBbox, onAddBox]);

  if (!src) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Page {pageNumber} — chargement…
      </div>
    );
  }

  const onContainerMouseDown = (e: React.MouseEvent) => {
    if (!creating || !onAddBox) return;
    if ((e.target as HTMLElement).closest("[data-bbox]")) return;
    const { x, y } = toLocal(e.clientX, e.clientY);
    setDrag({
      mode: "create",
      pageNumber,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });
  };

  const cursor = creating ? "crosshair" : "default";
  const draftRect =
    drag && drag.mode === "create"
      ? {
          x: Math.min(drag.startX, drag.currentX),
          y: Math.min(drag.startY, drag.currentY),
          w: Math.abs(drag.currentX - drag.startX),
          h: Math.abs(drag.currentY - drag.startY),
        }
      : null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">Page {pageNumber}</p>
      <div
        ref={containerRef}
        className="relative inline-block w-full bg-background border rounded shadow-sm select-none"
        style={{ cursor }}
        onMouseDown={onContainerMouseDown}
      >
        <img
          src={src}
          alt={`Page ${pageNumber}`}
          className="w-full h-auto block rounded pointer-events-none"
          draggable={false}
        />
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          style={{ pointerEvents: "none" }}
        >
          {boxes.map((b) => {
            const [ymin, xmin, ymax, xmax] = b.bbox;
            const w = Math.max(0, xmax - xmin);
            const h = Math.max(0, ymax - ymin);
            const i0 = b.index - 1;
            const stroke = b.selected
              ? "hsl(var(--primary))"
              : "hsl(var(--muted-foreground))";
            const fill = b.selected
              ? "hsl(var(--primary) / 0.10)"
              : "hsl(var(--muted-foreground) / 0.06)";
            const handleSize = 14;
            const handles: Array<{ k: "nw" | "ne" | "sw" | "se"; x: number; y: number }> = [
              { k: "nw", x: xmin, y: ymin },
              { k: "ne", x: xmax, y: ymin },
              { k: "sw", x: xmin, y: ymax },
              { k: "se", x: xmax, y: ymax },
            ];
            return (
              <g key={b.index} data-bbox style={{ pointerEvents: "auto" }}>
                <title>{b.label}</title>
                {/* Rect principal : drag = move */}
                <rect
                  x={xmin}
                  y={ymin}
                  width={w}
                  height={h}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: "move" }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const { x, y } = toLocal(e.clientX, e.clientY);
                    setDrag({
                      mode: "move",
                      i: i0,
                      startX: x,
                      startY: y,
                      startBbox: [...b.bbox] as Bbox,
                    });
                  }}
                  onClick={(e) => {
                    // Toggle uniquement si pas de drag effectif (drag null après mouseup)
                    e.stopPropagation();
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onToggleBox?.(i0);
                  }}
                />
                {/* Badge index + label */}
                <rect
                  x={xmin}
                  y={Math.max(0, ymin - 26)}
                  width={Math.max(36, String(b.index).length * 14 + 16)}
                  height={24}
                  fill={stroke}
                  rx={3}
                />
                <text
                  x={xmin + 8}
                  y={Math.max(18, ymin - 8)}
                  fontSize={16}
                  fontWeight={700}
                  fill="hsl(var(--primary-foreground))"
                  style={{ fontFamily: "system-ui, sans-serif", pointerEvents: "none" }}
                >
                  #{b.index}
                </text>
                {/* Poignées de redimensionnement */}
                {handles.map((hd) => (
                  <rect
                    key={hd.k}
                    x={hd.x - handleSize / 2}
                    y={hd.y - handleSize / 2}
                    width={handleSize}
                    height={handleSize}
                    fill="hsl(var(--background))"
                    stroke={stroke}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    style={{
                      cursor:
                        hd.k === "nw" || hd.k === "se" ? "nwse-resize" : "nesw-resize",
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const { x, y } = toLocal(e.clientX, e.clientY);
                      setDrag({
                        mode: "resize",
                        i: i0,
                        handle: hd.k,
                        startX: x,
                        startY: y,
                        startBbox: [...b.bbox] as Bbox,
                      });
                    }}
                  />
                ))}
              </g>
            );
          })}
          {/* Rect en cours de création */}
          {draftRect && (
            <rect
              x={draftRect.x}
              y={draftRect.y}
              width={draftRect.w}
              height={draftRect.h}
              fill="hsl(var(--primary) / 0.15)"
              stroke="hsl(var(--primary))"
              strokeDasharray="6 4"
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* Cartes d'info HTML positionnées au-dessus de chaque bbox (pour vérifier le texte associé) */}
        {boxes.map((b) => {
          const [ymin, xmin, ymax, xmax] = b.bbox;
          const top = (ymax / 1000) * 100;
          const left = (xmin / 1000) * 100;
          const width = ((xmax - xmin) / 1000) * 100;
          const i0 = b.index - 1;
          return (
            <div
              key={`info-${b.index}`}
              className="absolute z-10"
              style={{
                top: `calc(${top}% + 4px)`,
                left: `${left}%`,
                width: `${Math.max(width, 18)}%`,
                pointerEvents: "auto",
              }}
              data-bbox
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="bg-background/95 backdrop-blur border rounded shadow-sm p-1.5 text-[10px] leading-tight space-y-0.5">
                <div className="flex items-start gap-1">
                  <Badge
                    variant={b.selected ? "default" : "secondary"}
                    className="h-4 px-1 text-[9px] shrink-0"
                  >
                    #{b.index}
                  </Badge>
                  <span className="font-medium line-clamp-2 flex-1">{b.label}</span>
                  {onDeleteBox && (
                    <button
                      type="button"
                      className="text-destructive hover:opacity-70 shrink-0"
                      title="Supprimer cette zone"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBox(i0);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {b.subLabel && (
                  <div className="text-muted-foreground line-clamp-1">{b.subLabel}</div>
                )}
                {onToggleBox && (
                  <button
                    type="button"
                    className="text-[9px] text-primary hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBox(i0);
                    }}
                  >
                    {b.selected ? "Désélectionner" : "Sélectionner"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
