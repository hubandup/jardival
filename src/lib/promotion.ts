import { Product } from "@/types/product";
import { PromotionRow } from "@/hooks/usePromotions";
import { CATALOGUE_PROMOS } from "@/data/cataloguePromos";
import { repairImageUrl, type ImageAssetCandidate } from "@/lib/imageUrl";

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

export function promotionToProduct(
  p: PromotionRow,
  mediaAssetsOrIndex: ImageAssetCandidate[] | number = [],
): Product {
  const mediaAssets = Array.isArray(mediaAssetsOrIndex) ? mediaAssetsOrIndex : [];
  const price = p.price ?? 0;
  const oldPrice = p.original_price ?? undefined;
  const discount =
    oldPrice && oldPrice > price && price > 0
      ? Math.round(((oldPrice - price) / oldPrice) * 100)
      : 0;

  // Préférer image_urls (import XLSX) → image legacy → fallback catalogue PDF
  const urls = Array.isArray(p.image_urls)
    ? (p.image_urls as unknown[]).filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];
  const fallback = urls.length === 0 && !p.image ? findCatalogueFallback(p.title) : undefined;
  const rawImages = urls.length > 0
    ? urls
    : [p.image ?? fallback?.image ?? "/placeholder.svg"];
  const images = rawImages.map((src) => repairImageUrl(src, mediaAssets));
  const image = images[0];

  return {
    id: p.id,
    slug: p.slug ?? undefined,
    ref: p.reference ?? p.id.slice(0, 8),
    name: p.title,
    category: p.description ?? fallback?.category ?? "Promotion",
    description: p.description ?? undefined,
    image,
    images,
    price,
    oldPrice,
    discount,
    pageNumber: p.page_number ?? undefined,
    reference: p.reference ?? undefined,
    storeIds: p.store_ids ?? undefined,
  };
}
