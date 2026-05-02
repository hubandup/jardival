import { supabase } from "@/integrations/supabase/client";

// Cache module-level pour éviter de re-querier organization_members à chaque INSERT.
// undefined = pas encore chargé, null = chargé mais pas de membership, string = orgId.
let cachedOrgId: string | null | undefined = undefined;
let inflight: Promise<string | null> | null = null;

export function clearCurrentOrgIdCache(): void {
  cachedOrgId = undefined;
  inflight = null;
}

export async function getCurrentOrgId(): Promise<string | null> {
  if (cachedOrgId !== undefined) return cachedOrgId;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        cachedOrgId = null;
        return null;
      }
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("[getCurrentOrgId] Supabase error", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        cachedOrgId = null;
        return null;
      }
      cachedOrgId = data?.organization_id ?? null;
      return cachedOrgId;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

// Invalide le cache à la déconnexion ou la mise à jour user.
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "SIGNED_IN") {
    clearCurrentOrgIdCache();
  }
});
