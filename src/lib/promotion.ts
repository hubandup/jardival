import { Product } from "@/types/product";
import { PromotionRow } from "@/hooks/usePromotions";
import { CATALOGUE_PROMOS } from "@/data/cataloguePromos";

// Lookup par nom normalisé pour retrouver l'image locale du catalogue PDF
// quand la promo en DB n'a pas encore d'image uploadée.
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const CATALOGUE_BY_NAME = new Map(
  CATALOGUE_PROMOS.map((p) => [normalize(p.name), p])
);

export function findCatalogueFallback(title: string): Product | undefined {
  const key = normalize(title);
  if (CATALOGUE_BY_NAME.has(key)) return CATALOGUE_BY_NAME.get(key);
  // fallback souple : match partiel sur les premiers mots
  for (const [k, v] of CATALOGUE_BY_NAME) {
    if (k.startsWith(key) || key.startsWith(k)) return v;
  }
  return undefined;
}

export function promotionToProduct(p: PromotionRow): Product {
  const price = p.price ?? 0;
  const oldPrice = p.original_price ?? undefined;
  const discount =
    oldPrice && oldPrice > price && price > 0
      ? Math.round(((oldPrice - price) / oldPrice) * 100)
      : 0;

  const fallback = !p.image ? findCatalogueFallback(p.title) : undefined;
  const image = p.image ?? fallback?.image ?? "/placeholder.svg";

  return {
    id: p.id,
    ref: p.id.slice(0, 8),
    name: p.title,
    category: p.description ?? fallback?.category ?? "Promotion",
    image,
    images: [image],
    price,
    oldPrice,
    discount,
  };
}
