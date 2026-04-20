import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types/product";

export interface ProductRow {
  id: string;
  slug: string | null;
  ref: string | null;
  name: string;
  category: string | null;
  description: string | null;
  image: string | null;
  images: string[] | null;
  price: number | null;
  old_price: number | null;
  discount: number;
  is_new: boolean;
  display_order: number;
  active: boolean;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug ?? undefined,
    ref: row.ref ?? row.id,
    name: row.name,
    category: row.category ?? "",
    image: row.image ?? "",
    images: row.images && row.images.length > 0 ? row.images : row.image ? [row.image] : [],
    price: row.price ?? 0,
    oldPrice: row.old_price ?? undefined,
    discount: row.discount,
    isNew: row.is_new,
  };
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("display_order")
        .limit(2000);
      if (error) throw error;
      return (data as ProductRow[]).map(toProduct);
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Loads a product by its URL slug. As a fallback, tries to interpret the
 * parameter as a UUID (for legacy URLs and for promotion-only entries which
 * still use their UUID as URL).
 */
export function useProduct(slugOrId: string | undefined) {
  return useQuery({
    queryKey: ["product", slugOrId],
    enabled: !!slugOrId,
    queryFn: async () => {
      const key = slugOrId!;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

      // 1) Lookup by slug first
      let { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", key)
        .maybeSingle();
      if (error) throw error;

      // 2) Fallback to UUID lookup
      if (!data && isUuid) {
        const r = await supabase.from("products").select("*").eq("id", key).maybeSingle();
        if (r.error) throw r.error;
        data = r.data;
      }

      if (data) {
        return { row: data as ProductRow, product: toProduct(data as ProductRow) };
      }

      // 3) Final fallback: maybe it's a promotion (always UUID)
      if (!isUuid) return null;
      const { data: promo, error: promoErr } = await supabase
        .from("promotions")
        .select("*")
        .eq("id", key)
        .maybeSingle();
      if (promoErr) throw promoErr;
      if (!promo) return null;

      const price = promo.price ?? 0;
      const oldPrice = promo.original_price ?? undefined;
      const discount =
        oldPrice && oldPrice > price && price > 0
          ? Math.round(((oldPrice - price) / oldPrice) * 100)
          : 0;
      const { findCatalogueFallback } = await import("@/lib/promotion");
      const fallback = !promo.image ? findCatalogueFallback(promo.title) : undefined;
      const image = promo.image ?? fallback?.image ?? "";
      const row: ProductRow = {
        id: promo.id,
        slug: null,
        ref: promo.id.slice(0, 8),
        name: promo.title,
        category: promo.description ?? "Promotion",
        description: promo.description,
        image,
        images: image ? [image] : null,
        price,
        old_price: oldPrice ?? null,
        discount,
        is_new: false,
        display_order: promo.display_order,
        active: promo.active,
      };
      return { row, product: toProduct(row) };
    },
  });
}
