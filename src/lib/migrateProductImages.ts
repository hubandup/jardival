import { supabase } from "@/integrations/supabase/client";
import productsData from "@/data/products.json";

interface LocalProduct {
  id: string;
  ref?: string;
  name: string;
  image?: string;
  images?: string[];
}

const LOCAL_PRODUCTS = productsData as LocalProduct[];

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
 * One-shot : pour chaque produit en DB sans image, on cherche un match
 * dans products.json (par ref puis par nom normalisé), on télécharge
 * l'image source en blob, on l'uploade dans le bucket product-images,
 * et on met à jour la colonne `image` (+ `images` si dispo).
 */
export async function migrateProductImagesToBucket(): Promise<MigrationResult> {
  const result: MigrationResult = {
    total: 0,
    uploaded: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const { data: products, error } = await supabase
    .from("products")
    .select("id, ref, name, image")
    .limit(5000);
  if (error) throw error;
  if (!products) return result;

  const byRef = new Map<string, LocalProduct>();
  const byName = new Map<string, LocalProduct>();
  for (const p of LOCAL_PRODUCTS) {
    if (p.ref) byRef.set(p.ref.trim().toLowerCase(), p);
    byName.set(normalize(p.name), p);
  }

  result.total = products.length;

  for (const product of products) {
    if (product.image) {
      result.skipped++;
      continue;
    }

    let local: LocalProduct | undefined;
    if (product.ref) local = byRef.get(product.ref.trim().toLowerCase());
    if (!local) local = byName.get(normalize(product.name));
    if (!local?.image) {
      result.skipped++;
      continue;
    }

    try {
      const res = await fetch(local.image);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const blob = await res.blob();
      const ext = (local.image.split(".").pop() || "jpg")
        .split("?")[0]
        .slice(0, 5);
      const path = `migrated/${product.id}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, blob, { upsert: true, contentType: blob.type });
      if (upErr) throw upErr;
      result.uploaded++;

      const { data: pub } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);

      const { error: updErr } = await supabase
        .from("products")
        .update({
          image: pub.publicUrl,
          images: local.images?.length ? [pub.publicUrl] : null,
        })
        .eq("id", product.id);
      if (updErr) throw updErr;
      result.updated++;
    } catch (e) {
      result.errors.push(`${product.name}: ${(e as Error).message}`);
    }
  }

  return result;
}
