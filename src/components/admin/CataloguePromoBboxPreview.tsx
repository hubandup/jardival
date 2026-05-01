// Éditeur visuel des bounding boxes sur le PDF.
// Permet de : déplacer, redimensionner, supprimer, ajouter une zone,
// et de voir le texte (titre/prix) associé à chaque sélection pour vérifier la cohérence.
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  MousePointer2,
} from "lucide-react";
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
  imageUrl?: string | null; // image extraite (pour indicateur visuel)
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
  onSwapText?: (i: number, j: number) => void; // échange titre/prix/description entre deux promos
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
  onSwapText,
}: Props) {
  const [show, setShow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null); // index 0-based de la promo actuellement sélectionnée pour édition

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
        <div className="border-t p-3 space-y-4 max-h-[78vh] overflow-y-auto bg-muted/30">
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
                  allBoxes={boxes}
                  creating={creating}
                  activeIndex={activeIndex}
                  setActiveIndex={setActiveIndex}
                  onToggleBox={onToggleBox}
                  onDeleteBox={onDeleteBox}
                  onUpdateBbox={onUpdateBbox}
                  onUpdateText={onUpdateText}
                  onSwapText={onSwapText}
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
  allBoxes,
  creating,
  activeIndex,
  setActiveIndex,
  onToggleBox,
  onDeleteBox,
  onUpdateBbox,
  onAddBox,
  onUpdateText,
  onSwapText,
}: {
  pageNumber: number;
  src?: string;
  boxes: PreviewBox[];
  allBoxes: PreviewBox[];
  creating: boolean;
  activeIndex: number | null;
  setActiveIndex: (i: number | null) => void;
  onToggleBox?: (i: number) => void;
  onDeleteBox?: (i: number) => void;
  onUpdateBbox?: (i: number, bbox: Bbox) => void;
  onAddBox?: (bbox: Bbox) => void;
  onUpdateText?: (i: number, patch: PreviewTextPatch) => void;
  onSwapText?: (i: number, j: number) => void;
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
                  strokeDasharray={b.selected && !b.imageUrl ? "8 4" : undefined}
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
                    e.stopPropagation();
                    setActiveIndex(i0);
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

        {/* Cartes d'info HTML : uniquement pour la zone actuellement sélectionnée pour édition. */}
        {boxes.map((b) => {
          const i0 = b.index - 1;
          const isActive = activeIndex === i0;
          const [ymin, xmin, ymax, xmax] = b.bbox;
          const top = (ymax / 1000) * 100;
          const left = (xmin / 1000) * 100;
          const width = ((xmax - xmin) / 1000) * 100;

          // Cas non actif : on n'affiche QUE le badge titre minimal flottant en haut de la box.
          if (!isActive) {
            const topTitle = (ymin / 1000) * 100;
            return (
              <div
                key={`tag-${b.index}`}
                className="absolute z-[5] pointer-events-none"
                style={{
                  top: `calc(${topTitle}% - 22px)`,
                  left: `${left}%`,
                  maxWidth: `${Math.max(width, 25)}%`,
                }}
              >
                <div
                  className={
                    "truncate text-[10px] font-medium px-1.5 py-0.5 rounded shadow-sm " +
                    (b.selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground border border-border")
                  }
                  title={b.label}
                >
                  #{b.index} · {b.label}
                </div>
              </div>
            );
          }

          // Cas actif : carte d'édition complète sous la box.
          const inputBase =
            "bg-background border rounded outline-none px-1.5 py-1 text-xs transition-colors focus:ring-2 focus:ring-primary/30";
          const inputSel = b.selected
            ? "border-primary text-foreground focus:border-primary"
            : "border-muted-foreground/30 text-muted-foreground focus:border-muted-foreground";
          return (
            <div
              key={`info-${b.index}`}
              className="absolute z-20"
              style={{
                top: `calc(${top}% + 6px)`,
                left: `${left}%`,
                width: `${Math.max(width, 22)}%`,
                minWidth: 240,
                pointerEvents: "auto",
              }}
              data-bbox
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                className={
                  "bg-background/95 backdrop-blur rounded-md shadow-lg p-2 text-xs space-y-1.5 border-2 " +
                  (b.selected ? "border-primary" : "border-muted-foreground/40")
                }
              >
                <div className="flex items-start gap-1.5">
                  <Badge
                    variant={b.selected ? "default" : "secondary"}
                    className="h-5 px-1.5 text-[10px] shrink-0"
                  >
                    #{b.index}
                  </Badge>
                  {onUpdateText ? (
                    <input
                      type="text"
                      value={b.label}
                      onChange={(e) => onUpdateText(i0, { title: e.target.value })}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      className={`flex-1 min-w-0 font-medium ${inputBase} ${inputSel}`}
                      placeholder="Titre du produit"
                    />
                  ) : (
                    <span className="font-medium line-clamp-2 flex-1">{b.label}</span>
                  )}
                  {onDeleteBox && (
                    <button
                      type="button"
                      className="text-destructive hover:opacity-70 shrink-0 p-1"
                      title="Supprimer cette zone"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBox(i0);
                        setActiveIndex(null);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground p-1"
                    title="Fermer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIndex(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
                {onToggleBox && (
                  <button
                    type="button"
                    className={
                      "w-full text-[10px] py-1 rounded font-medium transition-colors " +
                      (b.selected
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-muted text-muted-foreground hover:bg-muted/80")
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBox(i0);
                    }}
                  >
                    {b.selected ? "✓ Sélectionnée — cliquer pour exclure" : "Cliquer pour sélectionner"}
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground italic">
                  Le détail (prix, description, image) est éditable dans le tableau de l'étape 3.
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

