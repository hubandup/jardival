// Scans all storage buckets AND all external image URLs referenced in app tables,
// then upserts missing entries into media_assets so they appear in the Médiathèque.
// Admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKETS = ["product-images", "promo-images", "store-images", "catalogues", "media"];
const EXTERNAL_BUCKET = "external";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const userId = user.id;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roleCheck } = await admin.rpc("is_admin", { _user_id: userId });
    if (!roleCheck) return json({ error: "Forbidden" }, 403);

    let inserted = 0;
    let scanned = 0;
    const errors: string[] = [];

    // 1) Storage buckets
    for (const bucket of BUCKETS) {
      try {
        const files = await listAll(admin, bucket);
        scanned += files.length;
        if (files.length === 0) continue;

        const { data: existing } = await admin
          .from("media_assets")
          .select("path")
          .eq("bucket", bucket);
        const existingPaths = new Set((existing ?? []).map((r: any) => r.path));

        const rows = files
          .filter((f) => !existingPaths.has(f.path))
          .map((f) => {
            const { data } = admin.storage.from(bucket).getPublicUrl(f.path);
            return {
              bucket,
              path: f.path,
              public_url: data.publicUrl,
              mime_type: f.mimetype ?? guessMime(f.path),
              size_bytes: f.size ?? null,
              title: prettyTitle(f.path),
            };
          });

        if (rows.length > 0) {
          const { error } = await admin.from("media_assets").insert(rows);
          if (error) errors.push(`${bucket}: ${error.message}`);
          else inserted += rows.length;
        }
      } catch (e) {
        errors.push(`${bucket}: ${(e as Error).message}`);
      }
    }

    // 2) External URLs referenced in app tables
    try {
      const externalUrls = await collectExternalUrls(admin);
      scanned += externalUrls.size;

      if (externalUrls.size > 0) {
        const { data: existing } = await admin
          .from("media_assets")
          .select("public_url")
          .in("public_url", Array.from(externalUrls));
        const existingUrls = new Set((existing ?? []).map((r: any) => r.public_url));

        const rows = Array.from(externalUrls)
          .filter((url) => !existingUrls.has(url))
          .map((url) => ({
            bucket: EXTERNAL_BUCKET,
            path: url, // external URL acts as a unique path
            public_url: url,
            mime_type: guessMime(url),
            title: prettyTitle(url),
          }));

        // Insert in chunks to avoid payload limits
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const slice = rows.slice(i, i + CHUNK);
          const { error } = await admin.from("media_assets").insert(slice);
          if (error) errors.push(`${EXTERNAL_BUCKET}: ${error.message}`);
          else inserted += slice.length;
        }
      }
    } catch (e) {
      errors.push(`${EXTERNAL_BUCKET}: ${(e as Error).message}`);
    }

    return json({ scanned, inserted, errors });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

async function collectExternalUrls(
  admin: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const urls = new Set<string>();
  const add = (u: unknown) => {
    if (typeof u !== "string") return;
    const url = u.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) return;
    // Skip URLs that already live in our Supabase Storage (handled by bucket scan)
    if (url.includes("/storage/v1/object/public/")) return;
    urls.add(url);
  };

  // Products: image + images[]
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await admin
      .from("products")
      .select("image, images")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      add((row as any).image);
      const imgs = (row as any).images;
      if (Array.isArray(imgs)) imgs.forEach(add);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Promotions
  const { data: promos, error: pErr } = await admin
    .from("promotions")
    .select("image");
  if (pErr) throw pErr;
  (promos ?? []).forEach((r: any) => add(r.image));

  // Stores
  const { data: stores, error: sErr } = await admin
    .from("stores")
    .select("image");
  if (sErr) throw sErr;
  (stores ?? []).forEach((r: any) => add(r.image));

  // Catalogues
  const { data: cats, error: cErr } = await admin
    .from("catalogues")
    .select("cover_image, pdf_url");
  if (cErr) throw cErr;
  (cats ?? []).forEach((r: any) => {
    add(r.cover_image);
    add(r.pdf_url);
  });

  return urls;
}

async function listAll(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix = "",
): Promise<Array<{ path: string; size?: number; mimetype?: string }>> {
  const out: Array<{ path: string; size?: number; mimetype?: string }> = [];
  const { data, error } = await admin.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  for (const item of data ?? []) {
    if (item.id === null) {
      const sub = await listAll(admin, bucket, prefix ? `${prefix}/${item.name}` : item.name);
      out.push(...sub);
    } else {
      out.push({
        path: prefix ? `${prefix}/${item.name}` : item.name,
        size: (item.metadata as any)?.size,
        mimetype: (item.metadata as any)?.mimetype,
      });
    }
  }
  return out;
}

function prettyTitle(path: string): string {
  const file = path.split("/").pop()?.split("?")[0] ?? path;
  return file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function guessMime(path: string): string | null {
  const ext = path.split("?")[0].split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    avif: "image/avif",
    pdf: "application/pdf",
  };
  return ext && map[ext] ? map[ext] : null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
