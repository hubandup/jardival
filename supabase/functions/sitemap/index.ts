import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://jardival.lovable.app";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, lastmod?: string, changefreq = "weekly", priority = "0.7") {
  const lm = lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : "";
  return `<url><loc>${xmlEscape(loc)}</loc>${lm}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().slice(0, 10);

    const [products, promos, stores, catalogues] = await Promise.all([
      supabase.from("products").select("id, slug, updated_at").eq("active", true).limit(5000),
      supabase.from("promotions").select("id, slug, updated_at, active, starts_at, ends_at").limit(5000),
      supabase.from("stores").select("id, slug, updated_at").limit(5000),
      supabase.from("catalogues").select("id, updated_at, active").limit(500),
    ]);

    const urls: string[] = [];

    // Static pages
    urls.push(urlEntry(`${SITE_URL}/`, today, "daily", "1.0"));
    urls.push(urlEntry(`${SITE_URL}/catalogue`, today, "weekly", "0.8"));
    urls.push(urlEntry(`${SITE_URL}/magasins`, today, "weekly", "0.8"));

    // Products
    (products.data ?? []).forEach((p: any) => {
      urls.push(urlEntry(`${SITE_URL}/produit/${p.slug || p.id}`, p.updated_at, "weekly", "0.7"));
    });

    // Active promos (also routed through /produit/:id)
    (promos.data ?? [])
      .filter((p: any) => {
        if (!p.active) return false;
        if (p.starts_at && today < p.starts_at) return false;
        if (p.ends_at && today > p.ends_at) return false;
        return true;
      })
      .forEach((p: any) => {
        urls.push(urlEntry(`${SITE_URL}/produit/${p.slug || p.id}`, p.updated_at, "weekly", "0.6"));
      });

    // Stores
    (stores.data ?? []).forEach((s: any) => {
      urls.push(urlEntry(`${SITE_URL}/magasins/${s.slug || s.id}`, s.updated_at, "monthly", "0.6"));
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new Response(`<!-- error: ${(e as Error).message} -->`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});
