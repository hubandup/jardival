import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://jardival.lovable.app";
const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

function isActive(p: { active: boolean; starts_at?: string | null; ends_at?: string | null }) {
  if (!p.active) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (p.starts_at && today < p.starts_at) return false;
  if (p.ends_at && today > p.ends_at) return false;
  return true;
}

function escapeMd(s: string | null | undefined): string {
  return (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const isFull = url.pathname.endsWith("llms-full.txt") || url.searchParams.get("full") === "1";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [products, promos, stores] = await Promise.all([
      supabase
        .from("products")
        .select("id, ref, name, category, description, price, old_price, discount, is_new")
        .eq("active", true)
        .order("display_order")
        .limit(2000),
      supabase
        .from("promotions")
        .select("id, title, description, price, original_price, starts_at, ends_at, active")
        .order("display_order")
        .limit(500),
      supabase
        .from("stores")
        .select("id, name, address, postal_code, city, phone, latitude, longitude, services, hours")
        .order("name")
        .limit(500),
    ]);

    const activePromos = (promos.data ?? []).filter(isActive);

    let md = "";

    md += `# Jardival\n\n`;
    md += `> Réseau de jardineries indépendantes en France. Catalogue de plus de ${products.data?.length ?? 0} produits, ${stores.data?.length ?? 0} magasins, et ${activePromos.length} promotions actives.\n\n`;
    md += `Site officiel : ${SITE_URL}\n\n`;
    md += `## Données structurées\n\n`;
    md += `- [Sitemap XML](${FN_URL}/sitemap)\n`;
    md += `- [Catalogue produits (JSON)](${FN_URL}/feed/products.json)\n`;
    md += `- [Magasins (JSON)](${FN_URL}/feed/stores.json)\n`;
    md += `- [Promotions actives (JSON)](${FN_URL}/feed/promotions.json)\n`;
    md += `- [Endpoint conversationnel](${FN_URL}/ask) — POST { question: string }\n\n`;

    md += `## Pages principales\n\n`;
    md += `- [Accueil](${SITE_URL}/) — Promotions du moment, catalogues, magasins\n`;
    md += `- [Catalogue](${SITE_URL}/catalogue) — Tous les produits\n`;
    md += `- [Magasins](${SITE_URL}/magasins) — Carte et liste des points de vente\n\n`;

    if (isFull) {
      md += `## Magasins\n\n`;
      for (const s of stores.data ?? []) {
        md += `### ${s.name}\n`;
        md += `- Adresse : ${escapeMd(s.address)}, ${s.postal_code ?? ""} ${escapeMd(s.city)}\n`;
        if (s.phone) md += `- Téléphone : ${s.phone}\n`;
        md += `- Coordonnées : ${s.latitude}, ${s.longitude}\n`;
        if (s.services?.length) md += `- Services : ${s.services.join(", ")}\n`;
        if (Array.isArray(s.hours)) {
          md += `- Horaires :\n`;
          for (const h of s.hours as Array<{ day: string; morning?: string; afternoon?: string; closed?: boolean }>) {
            md += `  - ${h.day} : ${h.closed ? "Fermé" : `${h.morning ?? ""} · ${h.afternoon ?? ""}`}\n`;
          }
        }
        md += `- URL : ${SITE_URL}/magasins/${s.id}\n\n`;
      }

      md += `## Promotions actives\n\n`;
      for (const p of activePromos) {
        md += `### ${p.title}\n`;
        if (p.description) md += `${escapeMd(p.description)}\n`;
        if (p.price != null) md += `- Prix : ${p.price} €${p.original_price ? ` (au lieu de ${p.original_price} €)` : ""}\n`;
        if (p.starts_at || p.ends_at) md += `- Validité : ${p.starts_at ?? "?"} → ${p.ends_at ?? "?"}\n`;
        md += `- URL : ${SITE_URL}/produit/${p.id}\n\n`;
      }

      md += `## Catalogue produits\n\n`;
      md += `| Réf | Nom | Catégorie | Prix | Prix barré |\n`;
      md += `|---|---|---|---|---|\n`;
      for (const p of products.data ?? []) {
        md += `| ${p.ref ?? ""} | ${escapeMd(p.name)} | ${escapeMd(p.category)} | ${p.price ?? ""} | ${p.old_price ?? ""} |\n`;
      }
      md += `\n`;
    } else {
      md += `## À propos\n\n`;
      md += `Jardival regroupe des jardineries de proximité. Pour le détail complet (tous les produits, magasins, promotions), voir [llms-full.txt](${FN_URL}/llms-full.txt).\n\n`;
      md += `### Catégories\n\n`;
      const categories = new Set<string>();
      (products.data ?? []).forEach((p) => p.category && categories.add(p.category));
      for (const c of Array.from(categories).sort()) md += `- ${c}\n`;
      md += `\n`;
      md += `### Quelques promotions actives\n\n`;
      for (const p of activePromos.slice(0, 10)) {
        md += `- **${p.title}**${p.price != null ? ` — ${p.price} €` : ""} : ${SITE_URL}/produit/${p.id}\n`;
      }
    }

    return new Response(md, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new Response(`# Error\n${(e as Error).message}`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
