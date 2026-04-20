import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Store, StoreHours, DEFAULT_HOURS, DEFAULT_SERVICES } from "@/data/stores";

interface StoreRow {
  id: string;
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
      return (data as StoreRow[]).map(rowToStore);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useStore(id: string | undefined) {
  return useQuery({
    queryKey: ["store", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("stores").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? rowToStore(data as StoreRow) : null;
    },
    enabled: !!id,
  });
}
