import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://jardival.lovable.app";

function isActive(p: { active: boolean; starts_at?: string | null; ends_at?: string | null }) {
  if (!p.active) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (p.starts_at && today < p.starts_at) return false;
  if (p.ends_at && today > p.ends_at) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Extract resource name from path: .../feed/products.json or .../feed/products
    const tail = url.pathname.split("/").pop() ?? "";
    const resource = tail.replace(/\.json$/, "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let payload: unknown;
    if (resource === "products") {
      const { data } = await supabase
        .from("products")
        .select("id, slug, ref, name, category, description, image, images, price, old_price, discount, is_new, updated_at")
        .eq("active", true)
        .order("display_order")
        .limit(5000);
      payload = {
        site: SITE_URL,
        generated_at: new Date().toISOString(),
        count: data?.length ?? 0,
        products: (data ?? []).map((p) => ({
          ...p,
          url: `${SITE_URL}/produit/${p.slug || p.id}`,
        })),
      };
    } else if (resource === "stores") {
      const { data } = await supabase
        .from("stores")
        .select("id, slug, name, address, postal_code, city, department, phone, latitude, longitude, services, hours, image, updated_at")
        .order("name")
        .limit(500);
      payload = {
        site: SITE_URL,
        generated_at: new Date().toISOString(),
        count: data?.length ?? 0,
        stores: (data ?? []).map((s) => ({
          ...s,
          url: `${SITE_URL}/magasins/${s.slug || s.id}`,
        })),
      };
    } else if (resource === "promotions") {
      const { data } = await supabase
        .from("promotions")
        .select("id, slug, title, description, image, price, original_price, starts_at, ends_at, active, store_ids, updated_at")
        .order("display_order")
        .limit(2000);
      const all = data ?? [];
      const activeOnly = all.filter(isActive);
      payload = {
        site: SITE_URL,
        generated_at: new Date().toISOString(),
        count: activeOnly.length,
        promotions: activeOnly.map((p) => ({
          ...p,
          url: `${SITE_URL}/produit/${p.slug || p.id}`,
        })),
      };
    } else {
      payload = {
        site: SITE_URL,
        feeds: {
          products: `${Deno.env.get("SUPABASE_URL")}/functions/v1/feed/products.json`,
          stores: `${Deno.env.get("SUPABASE_URL")}/functions/v1/feed/stores.json`,
          promotions: `${Deno.env.get("SUPABASE_URL")}/functions/v1/feed/promotions.json`,
        },
      };
    }

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
