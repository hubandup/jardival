import { Product } from "@/types/product";
import { PromotionRow } from "@/hooks/usePromotions";

export function promotionToProduct(p: PromotionRow): Product {
  const price = p.price ?? 0;
  const oldPrice = p.original_price ?? undefined;
  const discount =
    oldPrice && oldPrice > price && price > 0
      ? Math.round(((oldPrice - price) / oldPrice) * 100)
      : 0;
  return {
    id: p.id,
    ref: p.id.slice(0, 8),
    name: p.title,
    category: p.description ?? "Promotion",
    image: p.image ?? "/placeholder.svg",
    images: p.image ? [p.image] : ["/placeholder.svg"],
    price,
    oldPrice,
    discount,
  };
}
