// Edge function: extrait des promotions structurées depuis un PDF de catalogue
// via Lovable AI Gateway (Gemini 2.5 Pro, multimodal PDF support).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const extractRequestSchema = z.object({
  pdf_url: z.string().url("pdf_url doit être une URL valide"),
  catalogue_id: z.string().uuid().nullish(),
  starts_at: z.string().nullish(),
  ends_at: z.string().nullish(),
  // Bboxes ajustées par l'utilisateur lors d'une précédente extraction du MÊME catalogue.
  // Servent d'exemples concrets pour guider la nouvelle détection.
  previous_boxes: z
    .array(
      z.object({
        page_number: z.number().int().nullish(),
        bbox_2d: bboxSchema.nullish(),
        title: z.string().optional(),
      })
    )
    .nullish(),
});

type ExtractRequest = z.infer<typeof extractRequestSchema>;

// Les 9 zones de page utilisées en sortie. La nouvelle pipeline préfère une
// position grossière (zone) à une bbox visuelle : Gemini est très bon pour
// décrire textuellement la position d'un produit, mais beaucoup moins fiable
// pour fournir des coordonnées pixel exactes. La position permet ensuite de
// matcher chaque promo avec une image native extraite du PDF.
const POSITION_VALUES = [
  "haut-gauche",
  "haut-centre",
  "haut-droite",
  "milieu-gauche",
  "milieu-centre",
  "milieu-droite",
  "bas-gauche",
  "bas-centre",
  "bas-droite",
] as const;
type PositionZone = (typeof POSITION_VALUES)[number];

interface ExtractedPromo {
  title: string;
  description?: string;
  price?: number | null;
  original_price?: number | null;
  discount_percent?: number | null;
  category?: string | null;
  page_number?: number | null;
  position?: PositionZone | null;
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

    // --- Lecture & validation du body ---
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body JSON invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsedBody = extractRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      const issues = parsedBody.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join(" ; ");
      return new Response(
        JSON.stringify({ error: `Paramètres invalides : ${issues}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const body: ExtractRequest = parsedBody.data;

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

    // --- Résout l'organisation cible (multi-tenant) ---
    let organizationId: string | null = null;
    if (body.catalogue_id) {
      const { data: cat, error: catErr } = await supabase
        .from("catalogues")
        .select("organization_id")
        .eq("id", body.catalogue_id)
        .maybeSingle();
      if (catErr) console.warn("Lecture catalogue.organization_id échouée", catErr);
      else organizationId = cat?.organization_id ?? null;
    }

    // --- Apprentissage : agrégats sur les extractions validées passées (scoped par organisation) ---
    let learnedHints = "";
    try {
      let q = supabase
        .from("catalogue_extraction_stats")
        .select("bbox_width,bbox_height,aspect_ratio,had_price,had_original_price")
        .order("created_at", { ascending: false })
        .limit(500);
      if (organizationId) q = q.eq("organization_id", organizationId);
      const { data: stats } = await q;
      if (stats && stats.length >= 5) {
        const widths = stats.map((s: any) => Number(s.bbox_width)).filter((n: number) => Number.isFinite(n) && n > 0);
        const heights = stats.map((s: any) => Number(s.bbox_height)).filter((n: number) => Number.isFinite(n) && n > 0);
        const ratios = stats.map((s: any) => Number(s.aspect_ratio)).filter((n: number) => Number.isFinite(n) && n > 0);
        const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
        const med = (xs: number[]) => {
          if (!xs.length) return 0;
          const s = [...xs].sort((a, b) => a - b);
          return s[Math.floor(s.length / 2)];
        };
        const priceRate = stats.filter((s: any) => s.had_price).length / stats.length;
        const scope = organizationId ? "cette enseigne" : "tous catalogues confondus";
        learnedHints = `\n\nHISTORIQUE D'APPRENTISSAGE (${stats.length} promotions précédemment validées pour ${scope}) :
- Largeur médiane d'une zone produit : ~${Math.round(med(widths))}/1000 (moyenne ${Math.round(avg(widths))})
- Hauteur médiane d'une zone produit : ~${Math.round(med(heights))}/1000 (moyenne ${Math.round(avg(heights))})
- Ratio largeur/hauteur médian : ~${med(ratios).toFixed(2)}
- ${Math.round(priceRate * 100)}% des promotions validées avaient un prix unitaire affiché
Vise des bboxes proches de ces dimensions et évite les zones nettement plus petites (probables fragments parasites).`;
      }
    } catch (e) {
      console.warn("Lecture stats apprentissage échouée", e);
    }

    // --- Signal négatif : zones rejetées par l'admin sur cette même enseigne ---
    let rejectionHints = "";
    if (organizationId) {
      try {
        const { data: rejections } = await supabase
          .from("catalogue_extraction_rejections")
          .select("bbox,reason")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(30);
        if (rejections && rejections.length) {
          const lines = rejections
            .map((r: any) => {
              const b = r.bbox;
              const arr = Array.isArray(b)
                ? b
                : Array.isArray(b?.bbox)
                ? b.bbox
                : null;
              if (!arr || arr.length !== 4) return null;
              const reason = r.reason ? ` (${r.reason})` : "";
              return `  · [${arr.join(", ")}]${reason}`;
            })
            .filter(Boolean)
            .join("\n");
          if (lines) {
            rejectionHints = `\n\nZONES REJETÉES PAR L'ADMIN SUR DES CATALOGUES PRÉCÉDENTS DE CETTE ENSEIGNE (${rejections.length} exemples) :\n${lines}\nÉvite de proposer des zones similaires (mêmes coordonnées approximatives, même type de contenu non-produit).`;
          }
        }
      } catch (e) {
        console.warn("Lecture rejets apprentissage échouée", e);
      }
    }

    // --- Exemples concrets fournis par le client (ré-extraction du même catalogue) ---
    let previousExamples = "";
    if (Array.isArray(body.previous_boxes) && body.previous_boxes.length) {
      const sample = body.previous_boxes
        .filter((b) => b.bbox_2d && Array.isArray(b.bbox_2d) && b.bbox_2d.length === 4)
        .slice(0, 20)
        .map((b) => `  · page ${b.page_number ?? "?"} → bbox [${b.bbox_2d!.join(", ")}]${b.title ? ` (${b.title})` : ""}`)
        .join("\n");
      if (sample) {
        previousExamples = `\n\nEXEMPLES DE BBOXES VALIDÉES SUR CE MÊME CATALOGUE (à reproduire pour les autres pages) :\n${sample}`;
      }
    }

    const systemPrompt = `Tu es un assistant qui extrait les promotions d'un prospectus PDF de jardinerie.
Pour chaque promotion, extrais précisément :
- title : nom EXACT du produit tel qu'imprimé (concis, ex "Barbecue Charbon Serena")
- description : description courte (1 ligne) ou catégorie/référence si visible
- price : prix promotionnel en euros (nombre, ex 99.90). Si le prix n'est pas affiché à l'unité (ex: "-20% sur les géraniums"), mets 0
- original_price : prix original BARRÉ/avant promo s'il est affiché, sinon null
- discount_percent : pourcentage de réduction AFFICHÉ s'il est visible (sinon calcule-le à partir de price + original_price)
- category : famille produit (ex "Barbecue & Plancha", "Végétaux", "Animalerie")
- page_number : numéro de page où le produit apparaît (commence à 1)
- position : zone de la page où le produit apparaît, parmi exactement ces 9 valeurs :
  "haut-gauche" | "haut-centre" | "haut-droite"
  | "milieu-gauche" | "milieu-centre" | "milieu-droite"
  | "bas-gauche" | "bas-centre" | "bas-droite"
  Découpe mentalement la page en grille 3×3 et choisis la zone qui contient l'IMAGE (la photo) du produit. Choisis UNE seule valeur, la plus représentative. Si l'image chevauche deux zones, prends celle qui contient le centre de l'image.

RÈGLES IMPORTANTES :
- UN PRODUIT = UNE PROMO. Chaque promotion doit correspondre à un seul produit. Ne fusionne JAMAIS plusieurs produits dans une même entrée.
- Pour chaque promotion, extraire : le nom EXACT du produit, la description courte, le prix promotionnel, le prix original barré (s'il existe), et le pourcentage de réduction (s'il est affiché).

À IGNORER (NE PAS extraire ces éléments comme des promotions) :
- En-têtes et pieds de page (titre du catalogue, numéro de page, dates)
- Logos d'enseigne, mascottes, bannières marketing génériques
- Mentions légales, conditions de vente, astérisques explicatifs
- Adresses et coordonnées des magasins, encarts horaires
- Blocs de texte purement éditoriaux (édito, conseils saison, etc.) sans produit identifiable

N'invente rien. Si un champ n'est pas visible, mets null. Inclus toutes les promotions distinctes.${learnedHints}${rejectionHints}${previousExamples}`;

    // Timeout interne (plus court que la limite edge de 150s) pour pouvoir renvoyer une erreur propre
    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 140_000);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: aiController.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // gemini-2.5-flash : 3-5× plus rapide que pro sur PDF multi-pages,
        // qualité d'extraction structurée suffisante avec tool calling.
        model: "google/gemini-2.5-flash",
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
                        position: {
                          type: "string",
                          description: "Zone de la page (grille 3×3) où l'image du produit apparaît",
                          enum: [...POSITION_VALUES],
                        },
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
    }).finally(() => clearTimeout(aiTimeout));

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
    const rawList = parsed.promotions ?? [];
    const validPositions = new Set<string>(POSITION_VALUES);
    const promotions = rawList.map((p) => {
      const price = p.price ?? 0;
      const orig = p.original_price ?? null;
      let discount = p.discount_percent ?? null;
      if (!discount && orig && price && orig > price && price > 0) {
        discount = Math.round(((orig - price) / orig) * 100);
      }
      const rawPos = typeof p.position === "string" ? p.position : null;
      const position: PositionZone | null =
        rawPos && validPositions.has(rawPos) ? (rawPos as PositionZone) : null;
      return {
        title: p.title?.trim() ?? "",
        description: p.description?.trim() || p.category || null,
        price,
        original_price: orig,
        discount_percent: discount,
        category: p.category ?? null,
        page_number: p.page_number ?? null,
        position,
      };
    }).filter((p) => p.title.length > 0);

    // Fallback explicite : Gemini a répondu mais aucune promo exploitable n'a été extraite.
    // On renvoie une erreur claire au lieu d'un tableau vide silencieux.
    if (promotions.length === 0) {
      const reason = rawList.length === 0
        ? "Le modèle n'a détecté aucune promotion dans ce PDF."
        : `Le modèle a renvoyé ${rawList.length} entrée(s) mais aucune n'avait de titre exploitable.`;
      console.warn("Extraction sans résultat", { rawCount: rawList.length });
      return new Response(
        JSON.stringify({
          error: `${reason} Vérifiez que le PDF contient bien des produits en promotion lisibles, ou réessayez.`,
          promotions: [],
          count: 0,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ promotions, count: promotions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-catalogue-promos error", e);
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
    return new Response(
      JSON.stringify({
        error: isAbort
          ? "L'analyse IA du PDF a dépassé 140s. Essayez avec un PDF plus court ou réessayez."
          : e instanceof Error ? e.message : "Erreur inconnue",
      }),
      { status: isAbort ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
