import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PromotionRow {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  price: number | null;
  original_price: number | null;
  image: string | null;
  image_urls?: string[] | null;
  status?: "published" | "draft" | null;
  reference?: string | null;
  extra_fields?: Record<string, any> | null;
  starts_at: string | null;
  ends_at: string | null;
  store_ids: string[] | null;
  display_order: number;
  active: boolean;
  catalogue_id: string | null;
  catalogues?: {
    id: string;
    active: boolean;
    starts_at: string | null;
    ends_at: string | null;
  } | null;
}

export function isActiveNow(p: PromotionRow): boolean {
  if (!p.active) return false;
  if (p.status && p.status !== "published") return false;
  const today = new Date().toISOString().slice(0, 10);
  if (p.starts_at && today < p.starts_at) return false;
  if (p.ends_at && today > p.ends_at) return false;
  return true;
}

function hasActiveCatalogue(p: PromotionRow): boolean {
  const catalogue = p.catalogues;
  if (!catalogue?.id || !catalogue.active) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (catalogue.starts_at && today < catalogue.starts_at) return false;
  if (catalogue.ends_at && today > catalogue.ends_at) return false;
  return true;
}

export function usePromotions() {
  return useQuery({
    queryKey: ["promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*, catalogues!inner(id, active, starts_at, ends_at)")
        .order("display_order");
      if (error) throw error;
      return (data as PromotionRow[]).filter((p) => isActiveNow(p) && hasActiveCatalogue(p));
    },
    staleTime: 60 * 1000,
  });
}

export interface CatalogueHeroColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  foreground?: string;
}

export interface CatalogueRow {
  id: string;
  title: string;
  cover_image: string | null;
  pdf_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  display_order: number;
  active: boolean;
  hero_colors: CatalogueHeroColors | null;
}

export function useCatalogues() {
  return useQuery({
    queryKey: ["catalogues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogues")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as CatalogueRow[]).filter((c) => {
        if (!c.active) return false;
        const today = new Date().toISOString().slice(0, 10);
        if (c.starts_at && today < c.starts_at) return false;
        if (c.ends_at && today > c.ends_at) return false;
        return true;
      });
    },
    staleTime: 60 * 1000,
  });
}
