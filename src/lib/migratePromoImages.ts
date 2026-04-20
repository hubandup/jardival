import { supabase } from "@/integrations/supabase/client";
import { CATALOGUE_PROMOS } from "@/data/cataloguePromos";

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export interface MigrationResult {
  total: number;
  uploaded: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * One-shot: pour chaque promo en DB sans image, on cherche un asset local
 * dans CATALOGUE_PROMOS (matching par titre normalisé), on le télécharge
 * en blob, on l'uploade dans le bucket promo-images, puis on met à jour
 * la colonne `image` de la promo avec l'URL publique.
 */
export async function migratePromoImagesToBucket(): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    uploaded: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const { data: promos, error } = await supabase
    .from("promotions")
    .select("id, title, image");
  if (error) throw error;
  if (!promos) return result;

  const byName = new Map(CATALOGUE_PROMOS.map((p) => [normalize(p.name), p]));

  result.total = promos.length;

  for (const promo of promos) {
    if (promo.image) {
      result.skipped++;
      continue;
    }

    const key = normalize(promo.title);
    let local = byName.get(key);
    if (!local) {
      for (const [k, v] of byName) {
        if (k.startsWith(key) || key.startsWith(k)) {
          local = v;
          break;
        }
      }
    }
    if (!local) {
      result.skipped++;
      continue;
    }

    try {
      // Récupère l'asset bundlé par Vite en blob
      const res = await fetch(local.image);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const blob = await res.blob();
      const ext = (local.image.split(".").pop() || "jpg").split("?")[0];
      const path = `migrated/${promo.id}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("promo-images")
        .upload(path, blob, { upsert: true, contentType: blob.type });
      if (upErr) throw upErr;
      result.uploaded++;

      const { data: pub } = supabase.storage
        .from("promo-images")
        .getPublicUrl(path);

      const { error: updErr } = await supabase
        .from("promotions")
        .update({ image: pub.publicUrl })
        .eq("id", promo.id);
      if (updErr) throw updErr;
      result.updated++;
    } catch (e) {
      result.errors.push(`${promo.title}: ${(e as Error).message}`);
    }
  }

  return result;
}
