// Edge function: extrait des promotions structurées depuis un PDF de catalogue
// via Lovable AI Gateway (Gemini 2.5 Pro, multimodal PDF support).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
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

class AiExtractionError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "AiExtractionError";
    this.status = status;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize) as unknown as number[]
    );
  }
  return btoa(binary);
}

function parseAiPromotionsFromRaw(aiRaw: string, label: string): ExtractedPromo[] {
  let aiJson: any;
  try {
    aiJson = JSON.parse(aiRaw);
  } catch (e) {
    console.error("Réponse IA non-JSON", { label, error: String(e), preview: aiRaw.slice(0, 500) });
    throw new AiExtractionError("Réponse IA non parsable (probablement tronquée).", 502);
  }

  const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    console.error("Réponse IA sans tool call", { label, preview: JSON.stringify(aiJson).slice(0, 500) });
    throw new AiExtractionError("L'IA n'a pas renvoyé de promotions structurées.", 500);
  }

  const argsRaw = toolCall.function.arguments;
  if (typeof argsRaw !== "string" || argsRaw.trim().length === 0) {
    console.error("Tool call arguments vides", { label, type: typeof argsRaw });
    throw new AiExtractionError("L'IA a renvoyé un appel d'outil vide. Réessayez.", 502);
  }

  try {
    const parsed = JSON.parse(argsRaw);
    return Array.isArray(parsed?.promotions) ? parsed.promotions : [];
  } catch (e) {
    console.error("Parse error tool args", {
      label,
      error: String(e),
      length: argsRaw.length,
      head: argsRaw.slice(0, 300),
      tail: argsRaw.slice(-300),
    });
    throw new AiExtractionError("Réponse IA invalide (arguments tronqués). Réessayez.", 502);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Fallback partagé : si un crash survient APRÈS extraction, on renvoie les promos déjà en mémoire
  let fallbackPromotions: unknown[] | null = null;

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
    const bytes = new Uint8Array(pdfBuf);
    let pdfPayloads: Array<{ label: string; base64: string; pageOffset: number; pageCount: number }> = [
      { label: "catalogue complet", base64: bytesToBase64(bytes), pageOffset: 0, pageCount: 0 },
    ];
    try {
      const sourcePdf = await PDFDocument.load(pdfBuf);
      const totalPages = sourcePdf.getPageCount();
      pdfPayloads[0].pageCount = totalPages;
      if (totalPages > 6) {
        const pagesPerChunk = 4;
        const chunks: Array<{ label: string; base64: string; pageOffset: number; pageCount: number }> = [];
        for (let start = 0; start < totalPages; start += pagesPerChunk) {
          const end = Math.min(start + pagesPerChunk, totalPages);
          const chunkPdf = await PDFDocument.create();
          const copiedPages = await chunkPdf.copyPages(
            sourcePdf,
            Array.from({ length: end - start }, (_, i) => start + i)
          );
          copiedPages.forEach((page) => chunkPdf.addPage(page));
          const chunkBytes = await chunkPdf.save();
          chunks.push({
            label: `pages ${start + 1}-${end}`,
            base64: bytesToBase64(chunkBytes),
            pageOffset: start,
            pageCount: end - start,
          });
        }
        pdfPayloads = chunks;
        console.log("PDF découpé pour extraction IA", { totalPages, chunks: chunks.length, pagesPerChunk });
      }
    } catch (e) {
      console.warn("Découpage PDF impossible, extraction en une seule passe", e);
    }

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

    const systemPrompt = `Tu es un assistant qui extrait les promotions d'un prospectus PDF de jardinerie pour les afficher sur un site mobile.

OBJECTIF : extraire UNIQUEMENT les vrais produits avec un prix unitaire identifiable. La qualité prime sur la quantité.

DÉFINITION D'UNE PROMO VALIDE (TOUTES les conditions doivent être réunies) :

1. Le produit a un nom commercial identifiable (pas "Plantes méditerranéennes" en générique, mais "OLIVIER EN POT" ou "TERREAU AGRUMES").

2. Le produit a un prix UNITAIRE imprimé en gros caractères (format "XX,YY €" ou "XX€YY"). Les prix au litre/kilo en petits caractères ne comptent pas.

3. Le produit a une PHOTO distincte sur la page (pas un logo, pas un bandeau décoratif).

À EXTRAIRE :

- Chaque produit qui satisfait les 3 conditions ci-dessus = UNE entrée

- Si un produit a plusieurs déclinaisons avec des prix différents (ex: "Terreau À partir de 8,50€ unité / 17€ lot de 3"), crée UNE SEULE entrée avec le prix unitaire le plus bas, et mentionne les variantes dans description

À IGNORER FORMELLEMENT (NE crée PAS d'entrée pour) :

- Couverture du catalogue, page de garde, pages de coordonnées des magasins

- Logos d'enseigne (Jardival, Point Vert, marques fournisseurs comme Teragile, Algoflash, Vilmorin)

- Bandeaux "-X% DE REMISE" qui annoncent une remise sur une catégorie sans produit ni prix unitaire (ex: "-20% sur les géraniums", "-15% sur les rosiers")

- Mascottes, illustrations décoratives, photos d'ambiance sans produit

- Mentions légales, astérisques, conditions

- Encarts "Avec votre carte fidélité", QR codes, encarts éditoriaux

- Tableaux de comparaison de specs techniques sans visuel produit principal

- Pictogrammes "BIO", "Origine France", labels éco

CHAMPS À EXTRAIRE (pour chaque promo valide) :

- title : nom du produit en MAJUSCULES tel qu'imprimé en gros (ex "BARBECUE CHARBON SERENA"). Pas le slogan, pas la marque seule.

- description : 1 ligne max, avec contenance/quantité/référence si visible (ex "Cuve rectangulaire en acier peint, 73x46 cm")

- price : prix unitaire promotionnel en euros, nombre décimal (ex 99.90). OBLIGATOIRE : si tu ne vois pas de prix unitaire imprimé en gros, n'extrais PAS cette promo du tout.

- original_price : prix barré si visible, sinon null

- discount_percent : % affiché si visible, sinon null

- category : "Barbecue", "Mobilier jardin", "Végétaux", "Terreau & Paillage", "Outillage", "Phytosanitaire", "Animalerie", "Cave & Spiritueux", "Arrosage", "Décoration jardin"

- page_number : à partir de 1

- position : grille 3x3 — "haut-gauche/centre/droite", "milieu-gauche/centre/droite", "bas-gauche/centre/droite". Choisis la zone qui contient le CENTRE de la photo produit principale.

LIMITES DE QUANTITÉ ATTENDUES (utilise-les comme garde-fou) :

- Une page de catalogue retail standard contient entre 4 et 14 promos réelles

- La page de couverture contient 0 ou 1 promo

- La page de coordonnées finale contient 0 à 5 promos

- Si tu obtiens >15 entrées sur une page, relis la règle "À IGNORER" et supprime les entrées qui ne respectent pas les 3 conditions de validité.

VÉRIFICATION FINALE avant de renvoyer :

- Pour chaque entrée, demande-toi : "Est-ce qu'un client peut acheter CE produit précis à CE prix précis ?"

- Si la réponse est non (parce que c'est une remise catégorielle, un logo, une mention légale, un produit sans prix), supprime l'entrée.

N'invente rien. Si un champ optionnel n'est pas visible, mets null.${learnedHints}${rejectionHints}${previousExamples}`;

    async function extractPromotionsFromPayload(payload: (typeof pdfPayloads)[number]): Promise<ExtractedPromo[]> {
      const aiRequestBody = JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "file", file: { filename: "catalogue.pdf", file_data: `data:application/pdf;base64,${payload.base64}` } },
              { type: "text", text: `Extrais toutes les promotions de ce lot (${payload.label}).` },
            ],
          },
        ],
        tools: [{ type: "function", function: { name: "save_promotions", description: "Enregistre la liste des promotions extraites du catalogue.", parameters: { type: "object", properties: { promotions: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, price: { type: "number" }, original_price: { type: "number" }, discount_percent: { type: "number" }, category: { type: "string" }, page_number: { type: "number" }, position: { type: "string", description: "Zone de la page (grille 3×3) où l'image du produit apparaît", enum: [...POSITION_VALUES] } }, required: ["title"] } } }, required: ["promotions"] } } }],
        tool_choice: { type: "function", function: { name: "save_promotions" } },
      });

      let aiRaw = "";
      const maxAiAttempts = 2;
      for (let aiAttempt = 1; aiAttempt <= maxAiAttempts; aiAttempt++) {
        const aiController = new AbortController();
        const aiTimeout = setTimeout(() => aiController.abort(), 140_000);
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          signal: aiController.signal,
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: aiRequestBody,
        }).finally(() => clearTimeout(aiTimeout));

        if (!aiResp.ok) {
          const errText = await aiResp.text();
          console.error("AI gateway error", aiResp.status, errText, { attempt: aiAttempt, label: payload.label });
          if (aiResp.status === 429) throw new AiExtractionError("Limite de requêtes atteinte, réessayez dans une minute.", 429);
          if (aiResp.status === 402) throw new AiExtractionError("Crédits Lovable AI insuffisants. Ajoutez des fonds dans Settings > Workspace > Usage.", 402);
          throw new AiExtractionError(`Erreur IA (${aiResp.status})`, 500);
        }

        aiRaw = await aiResp.text();
        if (aiRaw.trim()) break;
        console.error("Réponse IA vide", { status: aiResp.status, contentLength: aiResp.headers.get("content-length"), attempt: aiAttempt, label: payload.label });
        if (aiAttempt < maxAiAttempts) await new Promise((r) => setTimeout(r, 1500));
      }

      if (!aiRaw.trim()) {
        throw new AiExtractionError(`L'IA a renvoyé une réponse vide pour ${payload.label}.`, 502);
      }

      return parseAiPromotionsFromRaw(aiRaw, payload.label).map((promo) => ({
        ...promo,
        page_number: typeof promo.page_number === "number" ? promo.page_number + payload.pageOffset : promo.page_number,
      }));
    }

    const rawList: ExtractedPromo[] = [];
    const extractionWarnings: string[] = [];
    for (const payload of pdfPayloads) {
      try {
        rawList.push(...await extractPromotionsFromPayload(payload));
      } catch (e) {
        const status = e instanceof AiExtractionError ? e.status : 500;
        const message = e instanceof Error ? e.message : String(e);
        console.error("Extraction IA lot échouée", { label: payload.label, status, message });
        if (status === 402 || status === 429 || pdfPayloads.length === 1) {
          return new Response(JSON.stringify({ error: message }), {
            status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        extractionWarnings.push(`${payload.label}: ${message}`);
      }
    }

    // Normalisation : recalcule discount si manquant
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

    // --- Appel au service Render pour extraire les images natives du PDF ---
    // Timeout 90s (cold start free tier ~30-50s la 1ère fois).
    // Échec ou timeout : on log et on renvoie les promos sans image_url, pas de crash.
    const RENDER_API_SECRET = Deno.env.get("RENDER_API_SECRET");
    type PromoWithImage = (typeof promotions)[number] & {
      image_url?: string | null;
      image_source?: "native" | null;
    };
    const enrichedPromotions: PromoWithImage[] = promotions.map((p) => ({
      ...p,
      image_url: null,
      image_source: null,
    }));
    // Dès qu'on a des promos extraites, on les expose au fallback
    fallbackPromotions = enrichedPromotions;

    if (RENDER_API_SECRET && organizationId && body.catalogue_id) {
      const renderController = new AbortController();
      const renderTimeout = setTimeout(() => renderController.abort(), 90_000);
      try {
        const renderPayload = {
          pdf_url: body.pdf_url,
          organization_id: organizationId,
          catalogue_id: body.catalogue_id,
          promos: promotions.map((p, i) => ({
            index: i,
            page_number: p.page_number,
            position: p.position,
            title: p.title,
          })),
        };
        const renderResp = await fetch("https://jardival-extract.onrender.com/extract", {
          method: "POST",
          signal: renderController.signal,
          headers: {
            Authorization: `Bearer ${RENDER_API_SECRET}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(renderPayload),
        });
        if (!renderResp.ok) {
          const errText = await renderResp.text().catch(() => "");
          console.error("Render extract failed", renderResp.status, errText.slice(0, 500));
        } else {
          // Lit en texte d'abord pour gérer le cas body vide / JSON tronqué
          // sans crash "Unexpected end of JSON input".
          const rawText = await renderResp.text().catch(() => "");
          let renderJson: {
            outputs?: Array<{ index: number; image_url: string | null; source?: string | null }>;
            stats?: unknown;
          } = {};
          if (rawText.trim().length === 0) {
            console.error("Render extract: réponse 200 mais body vide");
          } else {
            try {
              renderJson = JSON.parse(rawText);
            } catch (parseErr) {
              console.error("Render extract: JSON invalide", parseErr, "preview:", rawText.slice(0, 300));
            }
          }
          const outputs = Array.isArray(renderJson.outputs) ? renderJson.outputs : [];
          for (const out of outputs) {
            if (
              typeof out?.index === "number" &&
              out.index >= 0 &&
              out.index < enrichedPromotions.length &&
              typeof out.image_url === "string" &&
              out.image_url.length > 0
            ) {
              enrichedPromotions[out.index].image_url = out.image_url;
              enrichedPromotions[out.index].image_source = "native";
            }
          }
          console.log("Render extract OK", {
            received: outputs.length,
            withImage: outputs.filter((o) => o?.image_url).length,
            stats: renderJson.stats,
          });
        }
      } catch (e) {
        const isAbort = e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));
        console.error("Render extract error", isAbort ? "timeout 90s" : e);
      } finally {
        clearTimeout(renderTimeout);
      }
    } else {
      if (!RENDER_API_SECRET) console.warn("RENDER_API_SECRET non configurée, skip extraction images natives");
      if (!organizationId) console.warn("organization_id introuvable, skip extraction images natives");
      if (!body.catalogue_id) console.warn("catalogue_id non fourni, skip extraction images natives");
    }

    return new Response(
      JSON.stringify({ promotions: enrichedPromotions, count: enrichedPromotions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-catalogue-promos error", e);
    const isAbort = e instanceof Error && (e.name === "AbortError" || e.message.includes("aborted"));

    // Fallback : si on a déjà des promos extraites en mémoire, on les renvoie au lieu de 500
    if (fallbackPromotions && fallbackPromotions.length > 0) {
      console.warn("Crash après extraction — renvoi du fallback en mémoire", {
        count: fallbackPromotions.length,
        error: e instanceof Error ? e.message : String(e),
      });
      return new Response(
        JSON.stringify({
          promotions: fallbackPromotions,
          count: fallbackPromotions.length,
          warning: "Enrichissement partiel : une erreur est survenue après l'extraction (" +
            (e instanceof Error ? e.message : "erreur inconnue") + ").",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
