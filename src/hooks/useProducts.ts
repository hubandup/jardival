import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types/product";

export interface ProductRow {
  id: string;
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

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["product", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ? { row: data as ProductRow, product: toProduct(data as ProductRow) } : null;
    },
  });
}
