import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PromotionRow } from "./usePromotions";
import { promotionToProduct } from "@/lib/promotion";

/**
 * Récupère une promo par slug, puis fallback id. Utilisé pour contextualiser /magasins.
 */
export function usePromotionByKey(key: string | null | undefined) {
  return useQuery({
    queryKey: ["promotion-by-key", key],
    enabled: !!key,
    queryFn: async () => {
      if (!key) return null;
      const bySlug = await supabase
        .from("promotions")
        .select("*")
        .eq("slug", key)
        .maybeSingle();
      if (bySlug.error && bySlug.error.code !== "PGRST116") throw bySlug.error;
      let row = bySlug.data as PromotionRow | null;
      if (!row) {
        // try by id (uuid)
        const looksLikeUuid = /^[0-9a-f-]{36}$/i.test(key);
        if (looksLikeUuid) {
          const byId = await supabase
            .from("promotions")
            .select("*")
            .eq("id", key)
            .maybeSingle();
          if (byId.error) throw byId.error;
          row = byId.data as PromotionRow | null;
        }
      }
      if (!row) return null;
      return { row, product: promotionToProduct(row) };
    },
    staleTime: 60 * 1000,
  });
}
