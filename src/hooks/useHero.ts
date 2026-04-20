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
  href: string;
}

function computeDiscount(p: PromotionRow & { hero_featured?: boolean }): number | null {
  if (p.price && p.original_price && p.original_price > p.price) {
    return Math.round((1 - p.price / p.original_price) * 100);
  }
  return null;
}

function extractRef(description: string | null | undefined): string | null {
  if (!description) return null;
  const m = description.match(/Réf\.\s*(\d+)/i);
  return m ? m[1] : null;
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
        if (pool.length === 0) pool = all;
      } else {
        pool = [...all].sort(() => Math.random() - 0.5);
      }
      // Fallback : pour TOUTES les promos actives, on tente de résoudre une image
      // (priorité : promo.image, puis produit par ref extraite de la description)
      const allRefs = pool
        .map((p) => extractRef(p.description))
        .filter((r): r is string => !!r);
      let imageByRef = new Map<string, string | null>();
      let slugByRef = new Map<string, string | null>();
      if (allRefs.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("ref, image, slug, id")
          .in("ref", allRefs);
        imageByRef = new Map(
          (products ?? []).map((p) => [
            p.ref as string,
            (p as { image: string | null }).image,
          ]),
        );
        slugByRef = new Map(
          (products ?? []).map((p) => [
            p.ref as string,
            ((p as { slug: string | null }).slug) ?? (p as { id: string }).id,
          ]),
        );
      }

      const resolveImage = (p: PromotionRow): string | null => {
        if (p.image) return p.image;
        const ref = extractRef(p.description);
        return ref ? imageByRef.get(ref) ?? null : null;
      };

      const resolveHref = (p: PromotionRow): string => {
        const ref = extractRef(p.description);
        const slug = ref ? slugByRef.get(ref) : null;
        return slug ? `/produit/${slug}` : "/catalogue";
      };

      // On garde uniquement celles qui ont une image résoluble, et on prend les 4 premières
      const withImage = pool.filter((p) => !!resolveImage(p)).slice(0, 4);
      const finalSelection = withImage.length >= 4 ? withImage : [...withImage, ...pool.filter((p) => !withImage.includes(p))].slice(0, 4);

      const promos: HeroPromo[] = finalSelection.map((p) => ({
        id: p.id,
        title: p.title,
        image: resolveImage(p),
        price: p.price,
        original_price: p.original_price,
        discount: computeDiscount(p),
        href: resolveHref(p),
      }));
      return { promos, activeCount: all.length };
    },
    staleTime: 30 * 1000,
  });
}
