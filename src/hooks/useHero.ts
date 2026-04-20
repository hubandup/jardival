import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isActiveNow, type PromotionRow } from "./usePromotions";

export type HeroMode = "manual" | "random";

export function useHeroMode() {
  return useQuery({
    queryKey: ["site_setting", "hero_mode"],
    queryFn: async (): Promise<HeroMode> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "hero_mode")
        .maybeSingle();
      if (error) throw error;
      const v = (data?.value as unknown) ?? "random";
      return v === "manual" ? "manual" : "random";
    },
    staleTime: 60 * 1000,
  });
}

export function useSetHeroMode() {
  const qc = useQueryClient();
  return async (mode: HeroMode) => {
    const { error } = await supabase
      .from("site_settings")
      .upsert([{ key: "hero_mode", value: mode as never, updated_at: new Date().toISOString() }], { onConflict: "key" });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["site_setting", "hero_mode"] });
    qc.invalidateQueries({ queryKey: ["hero_promos"] });
  };
}

export interface HeroPromo {
  id: string;
  title: string;
  image: string | null;
  price: number | null;
  original_price: number | null;
  discount: number | null;
}

function computeDiscount(p: PromotionRow & { hero_featured?: boolean }): number | null {
  if (p.price && p.original_price && p.original_price > p.price) {
    return Math.round((1 - p.price / p.original_price) * 100);
  }
  return null;
}

export function useHeroPromos() {
  const { data: mode = "random" } = useHeroMode();
  return useQuery({
    queryKey: ["hero_promos", mode],
    queryFn: async (): Promise<{ promos: HeroPromo[]; activeCount: number }> => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("display_order");
      if (error) throw error;
      const all = (data as (PromotionRow & { hero_featured: boolean })[]).filter(isActiveNow);
      let pool: typeof all;
      if (mode === "manual") {
        pool = all.filter((p) => p.hero_featured);
        if (pool.length === 0) {
          // Fallback: take any active promos
          pool = all;
        }
      } else {
        pool = [...all].sort(() => Math.random() - 0.5);
      }
      const promos: HeroPromo[] = pool.slice(0, 4).map((p) => ({
        id: p.id,
        title: p.title,
        image: p.image,
        price: p.price,
        original_price: p.original_price,
        discount: computeDiscount(p),
      }));
      return { promos, activeCount: all.length };
    },
    staleTime: 30 * 1000,
  });
}
