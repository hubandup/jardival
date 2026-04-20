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
    if (req.method === "GET") {
      // Description for crawlers/agents
      return new Response(
        JSON.stringify({
          name: "Jardival ask endpoint",
          description: "Ask any question about Jardival (products, stores, promotions, opening hours).",
          method: "POST",
          body: { question: "string" },
          example: { question: "Quels sont les horaires du magasin d'Arbois ?" },
        }, null, 2),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const question = (body.question ?? body.q ?? "").toString().trim();
    if (!question) {
      return new Response(JSON.stringify({ error: "Missing 'question' field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (question.length > 1000) {
      return new Response(JSON.stringify({ error: "Question too long (max 1000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [products, stores, promos] = await Promise.all([
      supabase.from("products").select("id, ref, name, category, price, old_price").eq("active", true).limit(2000),
      supabase.from("stores").select("id, name, address, postal_code, city, phone, hours, services").limit(500),
      supabase.from("promotions").select("id, title, description, price, original_price, active, starts_at, ends_at").limit(500),
    ]);

    const activePromos = (promos.data ?? []).filter(isActive);

    const context = `# Jardival — données du site (${new Date().toISOString().slice(0, 10)})

## Magasins (${stores.data?.length ?? 0})
${(stores.data ?? []).map((s) => `- ${s.name} — ${s.address}, ${s.postal_code ?? ""} ${s.city}${s.phone ? ` — ${s.phone}` : ""}${s.services?.length ? ` — services: ${s.services.join(", ")}` : ""}${Array.isArray(s.hours) ? ` — horaires: ${(s.hours as Array<{ day: string; morning?: string; afternoon?: string; closed?: boolean }>).map((h) => `${h.day}: ${h.closed ? "fermé" : `${h.morning ?? ""} ${h.afternoon ?? ""}`}`).join(" | ")}` : ""} — ${SITE_URL}/magasins/${s.id}`).join("\n")}

## Promotions actives (${activePromos.length})
${activePromos.map((p) => `- ${p.title}${p.price != null ? ` — ${p.price} €${p.original_price ? ` (était ${p.original_price} €)` : ""}` : ""}${p.ends_at ? ` — jusqu'au ${p.ends_at}` : ""}`).join("\n")}

## Catalogue (extrait — ${products.data?.length ?? 0} produits)
${(products.data ?? []).slice(0, 200).map((p) => `- [${p.ref ?? ""}] ${p.name} (${p.category ?? "—"})${p.price != null ? ` — ${p.price} €` : ""}`).join("\n")}
`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Tu es l'assistant officiel de Jardival, un réseau français de jardineries. Réponds en français, de façon concise et factuelle, en utilisant UNIQUEMENT les données ci-dessous. Si l'information n'est pas dans les données, dis-le clairement et invite à consulter ${SITE_URL}. Cite toujours les URLs pertinentes.\n\n${context}`,
          },
          { role: "user", content: question },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI gateway error", details: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const answer = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({
      question,
      answer,
      sources: {
        site: SITE_URL,
        feeds: {
          products: `${Deno.env.get("SUPABASE_URL")}/functions/v1/feed/products.json`,
          stores: `${Deno.env.get("SUPABASE_URL")}/functions/v1/feed/stores.json`,
          promotions: `${Deno.env.get("SUPABASE_URL")}/functions/v1/feed/promotions.json`,
        },
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
