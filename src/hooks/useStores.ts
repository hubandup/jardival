import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Store, StoreHours, DEFAULT_HOURS, DEFAULT_SERVICES } from "@/data/stores";

interface StoreRow {
  id: string;
  slug: string | null;
  name: string;
  address: string;
  postal_code: string | null;
  city: string;
  department: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  hours: unknown;
  services: string[] | null;
  image: string | null;
}

export function rowToStore(r: StoreRow): Store {
  const hoursArr = Array.isArray(r.hours) ? (r.hours as StoreHours[]) : null;
  return {
    id: r.id,
    slug: r.slug ?? undefined,
    name: r.name,
    address: r.address,
    postalCode: r.postal_code ?? undefined,
    city: r.city,
    department: r.department,
    coords: [Number(r.latitude), Number(r.longitude)],
    phone: r.phone ?? "+33 0 00 00 00 00",
    hours: hoursArr && hoursArr.length > 0 ? hoursArr : DEFAULT_HOURS,
    services: r.services && r.services.length > 0 ? r.services : DEFAULT_SERVICES,
    image: r.image ?? undefined,
  };
}

export function useStores() {
  return useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*").order("name");
      if (error) throw error;
      return (data as unknown as StoreRow[]).map(rowToStore);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Loads a store by URL slug, falling back to id (legacy URLs / id-as-slug).
 */
export function useStore(slugOrId: string | undefined) {
  return useQuery({
    queryKey: ["store", slugOrId],
    queryFn: async () => {
      if (!slugOrId) return null;
      // 1) by slug
      const bySlug = await supabase
        .from("stores")
        .select("*")
        .eq("slug", slugOrId)
        .maybeSingle();
      if (bySlug.error) throw bySlug.error;
      if (bySlug.data) return rowToStore(bySlug.data as unknown as StoreRow);
      // 2) by id (legacy)
      const byId = await supabase
        .from("stores")
        .select("*")
        .eq("id", slugOrId)
        .maybeSingle();
      if (byId.error) throw byId.error;
      return byId.data ? rowToStore(byId.data as unknown as StoreRow) : null;
    },
    enabled: !!slugOrId,
  });
}
