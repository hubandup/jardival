import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Constant-time string comparison to prevent timing attacks.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  organization_id: z.string().regex(UUID_RE, "organization_id must be a UUID"),
  catalogue_id: z.string().regex(UUID_RE, "catalogue_id must be a UUID"),
  page_number: z.number().int().min(0).max(10000),
  image_index: z.number().int().min(0).max(10000),
  image_base64: z.string().min(1).max(25_000_000), // ~18MB binary max after decode
  content_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const MAX_DECODED_BYTES = 15 * 1024 * 1024; // 15 MB

function decodeBase64(b64: string): Uint8Array {
  // Strip data URL prefix if present.
  const clean = b64.includes(",") ? b64.split(",", 2)[1] : b64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Auth via shared secret.
  const expectedSecret = Deno.env.get("RENDER_API_SECRET");
  if (!expectedSecret) {
    console.error("RENDER_API_SECRET is not configured");
    return json({ error: "Server misconfigured" }, 500);
  }
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  const provided = authHeader.slice("Bearer ".length).trim();
  if (!safeEqual(provided, expectedSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Parse + validate body.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      400,
    );
  }
  const {
    organization_id,
    catalogue_id,
    page_number,
    image_index,
    image_base64,
    content_type,
  } = parsed.data;

  // Decode base64.
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(image_base64);
  } catch {
    return json({ error: "Invalid base64 payload" }, 400);
  }
  if (bytes.byteLength === 0) {
    return json({ error: "Empty image payload" }, 400);
  }
  if (bytes.byteLength > MAX_DECODED_BYTES) {
    return json({ error: "Image too large" }, 413);
  }

  // Build storage path. Extension hardcoded to .jpg per spec.
  const path = `extracted-native/${organization_id}/${catalogue_id}/${page_number}_${image_index}.jpg`;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error: uploadError } = await supabase.storage
    .from("promo-images")
    .upload(path, bytes, {
      contentType: content_type,
      upsert: true,
    });

  if (uploadError) {
    console.error("Upload failed", uploadError);
    return json({ error: "Upload failed" }, 500);
  }

  const { data: pub } = supabase.storage
    .from("promo-images")
    .getPublicUrl(path);

  return json({ public_url: pub.publicUrl });
});
