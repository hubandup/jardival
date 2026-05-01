// Normalisation pure des promotions retournées par Gemini.
// Logique partagée pour permettre des tests unitaires sans dépendances Deno/Edge.
import { POSITION_ZONES, type Bbox, type PositionZone } from "@/types/catalogue";

export interface RawExtractedPromo {
  title?: string | null;
  description?: string | null;
  price?: number | null;
  original_price?: number | null;
  discount_percent?: number | null;
  category?: string | null;
  page_number?: number | null;
  position?: unknown;
  bbox_2d?: unknown;
}

export interface NormalizedPromo {
  title: string;
  description: string | null;
  price: number;
  original_price: number | null;
  discount_percent: number | null;
  category: string | null;
  page_number: number | null;
  position: PositionZone | null;
  bbox_2d: Bbox | null;
}

function isValidBbox(v: unknown): v is Bbox {
  return (
    Array.isArray(v) &&
    v.length === 4 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

const VALID_POSITIONS = new Set<string>(POSITION_ZONES);

export function normalizePromos(raw: RawExtractedPromo[]): NormalizedPromo[] {
  return raw
    .map((p): NormalizedPromo => {
      const price = typeof p.price === "number" && Number.isFinite(p.price) ? p.price : 0;
      const orig =
        typeof p.original_price === "number" && Number.isFinite(p.original_price)
          ? p.original_price
          : null;
      let discount = typeof p.discount_percent === "number" ? p.discount_percent : null;
      if (!discount && orig && price && orig > price && price > 0) {
        discount = Math.round(((orig - price) / orig) * 100);
      }
      const rawPos = typeof p.position === "string" ? p.position : null;
      const position: PositionZone | null =
        rawPos && VALID_POSITIONS.has(rawPos) ? (rawPos as PositionZone) : null;
      return {
        title: (p.title ?? "").trim(),
        description: (p.description ?? "").trim() || p.category || null,
        price,
        original_price: orig,
        discount_percent: discount,
        category: p.category ?? null,
        page_number:
          typeof p.page_number === "number" && Number.isFinite(p.page_number)
            ? p.page_number
            : null,
        position,
        bbox_2d: isValidBbox(p.bbox_2d) ? p.bbox_2d : null,
      };
    })
    .filter((p) => p.title.length > 0);
}
