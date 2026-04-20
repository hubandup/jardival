// Scans all known storage buckets and inserts missing entries in media_assets.
// Admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKETS = ["product-images", "promo-images", "store-images", "catalogues", "media"];

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
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const userId = claims.claims.sub;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roleCheck } = await admin.rpc("is_admin", { _user_id: userId });
    if (!roleCheck) return json({ error: "Forbidden" }, 403);

    let inserted = 0;
    let scanned = 0;
    const errors: string[] = [];

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
              mime_type: f.mimetype ?? null,
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

    return json({ scanned, inserted, errors });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

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
      // folder — recurse
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
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
