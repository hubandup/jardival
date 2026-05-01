// Edge function: extrait des promotions structurées depuis un PDF de catalogue
// via Lovable AI Gateway (Gemini 2.5 Pro, multimodal PDF support).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExtractRequest {
  pdf_url: string;
  starts_at?: string | null;
  ends_at?: string | null;
}

interface ExtractedPromo {
  title: string;
  description?: string;
  price?: number | null;
  original_price?: number | null;
  discount_percent?: number | null;
  category?: string | null;
  page_number?: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth check : doit être admin ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Session invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdminData } = await supabase.rpc("is_admin", {
      _user_id: userData.user.id,
    });
    if (!isAdminData) {
      return new Response(JSON.stringify({ error: "Admin requis" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Lecture du body ---
    const body = (await req.json()) as ExtractRequest;
    if (!body.pdf_url) {
      return new Response(JSON.stringify({ error: "pdf_url manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Téléchargement du PDF ---
    const pdfResp = await fetch(body.pdf_url);
    if (!pdfResp.ok) {
      return new Response(
        JSON.stringify({ error: `Impossible de télécharger le PDF (${pdfResp.status})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const pdfBuf = await pdfResp.arrayBuffer();
    // Encode en base64
    const bytes = new Uint8Array(pdfBuf);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, i + chunkSize) as unknown as number[]
      );
    }
    const pdfBase64 = btoa(binary);

    // --- Appel Lovable AI Gateway avec tool calling ---
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY non configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Tu es un assistant qui extrait les promotions d'un prospectus PDF de jardinerie.
Pour chaque produit en promotion visible, retourne :
- title : nom du produit (concis, ex "Barbecue Charbon Serena")
- description : courte description (1 ligne) ou catégorie/référence si visible
- price : prix actuel en euros (nombre, ex 99.90). Si le prix n'est pas affiché à l'unité (ex: "-20% sur les géraniums"), mets 0
- original_price : prix barré/avant promo s'il est affiché, sinon null
- discount_percent : pourcentage de remise affiché s'il est visible, sinon calcule-le si tu as price + original_price
- category : famille produit (ex "Barbecue & Plancha", "Végétaux", "Animalerie")
- page_number : numéro de page où le produit apparaît

N'invente rien. Si un champ n'est pas visible, mets null. Inclus toutes les promotions distinctes.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "file",
                file: {
                  filename: "catalogue.pdf",
                  file_data: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
              {
                type: "text",
                text: "Extrais toutes les promotions de ce catalogue.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_promotions",
              description: "Enregistre la liste des promotions extraites du catalogue.",
              parameters: {
                type: "object",
                properties: {
                  promotions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        price: { type: "number" },
                        original_price: { type: "number" },
                        discount_percent: { type: "number" },
                        category: { type: "string" },
                        page_number: { type: "number" },
                      },
                      required: ["title"],
                    },
                  },
                },
                required: ["promotions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_promotions" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte, réessayez dans une minute." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits Lovable AI insuffisants. Ajoutez des fonds dans Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: `Erreur IA (${aiResp.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("Réponse IA sans tool call", JSON.stringify(aiJson).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "L'IA n'a pas renvoyé de promotions structurées." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: { promotions: ExtractedPromo[] };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Parse error", e);
      return new Response(
        JSON.stringify({ error: "Réponse IA invalide." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalisation : recalcule discount si manquant
    const promotions = (parsed.promotions ?? []).map((p) => {
      const price = p.price ?? 0;
      const orig = p.original_price ?? null;
      let discount = p.discount_percent ?? null;
      if (!discount && orig && price && orig > price && price > 0) {
        discount = Math.round(((orig - price) / orig) * 100);
      }
      return {
        title: p.title?.trim() ?? "",
        description: p.description?.trim() || p.category || null,
        price,
        original_price: orig,
        discount_percent: discount,
        category: p.category ?? null,
        page_number: p.page_number ?? null,
      };
    }).filter((p) => p.title.length > 0);

    return new Response(
      JSON.stringify({ promotions, count: promotions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-catalogue-promos error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
