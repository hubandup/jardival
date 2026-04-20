import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PromotionRow {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  original_price: number | null;
  image: string | null;
  starts_at: string | null;
  ends_at: string | null;
  store_ids: string[] | null;
  display_order: number;
  active: boolean;
}

export function isActiveNow(p: PromotionRow): boolean {
  if (!p.active) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (p.starts_at && today < p.starts_at) return false;
  if (p.ends_at && today > p.ends_at) return false;
  return true;
}

export function usePromotions() {
  return useQuery({
    queryKey: ["promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data as PromotionRow[]).filter(isActiveNow);
    },
    staleTime: 60 * 1000,
  });
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
}

export function useCatalogues() {
  return useQuery({
    queryKey: ["catalogues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogues")
        .select("*")
        .order("display_order");
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
