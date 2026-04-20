import * as XLSX from "xlsx";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type PromoRow = Database["public"]["Tables"]["promotions"]["Row"];
type PromoUpsert = Database["public"]["Tables"]["promotions"]["Insert"];

export interface ParsedPromotion extends PromoUpsert {
  image_filename?: string | null;
}

const COLUMNS = [
  "id",
  "title",
  "description",
  "price",
  "original_price",
  "starts_at",
  "ends_at",
  "active",
  "display_order",
  "image",
  "store_ids",
] as const;

function toCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.join(" | ");
  if (typeof value === "object") return JSON.stringify(value);
  return value as string | number | boolean;
}

export function exportPromotionsToXlsx(promos: PromoRow[]): void {
  const rows = promos.map((p) => {
    const row: Record<string, unknown> = {};
    for (const key of COLUMNS) row[key] = toCell((p as any)[key]);
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...COLUMNS] });
  (ws as any)["!cols"] = [
    { wch: 36 }, { wch: 36 }, { wch: 40 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 50 }, { wch: 30 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Promotions");
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `jardival-promotions-${today}.xlsx`);
}

function str(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

function num(raw: unknown, field: string): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
  if (Number.isNaN(n)) throw new Error(`${field} invalide: ${raw}`);
  return n;
}

function bool(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw === null || raw === undefined || raw === "") return true;
  const s = String(raw).trim().toLowerCase();
  return s === "true" || s === "1" || s === "oui" || s === "yes";
}

function parseList(raw: unknown): string[] | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(String).map((x) => x.trim()).filter(Boolean);
    } catch { /* fallthrough */ }
  }
  return s.split("|").map((x) => x.trim()).filter(Boolean);
}

function parseDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim();
  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`date invalide: ${s}`);
  return d.toISOString().slice(0, 10);
}

export async function parsePromotionsFromFile(file: File): Promise<ParsedPromotion[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Le fichier ne contient aucune feuille");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  if (rows.length === 0) throw new Error("Le fichier est vide");

  return rows.map((row, i) => {
    try {
      const title = str(row.title);
      if (!title) throw new Error("title requis");
      const id = str(row.id);
      const out: ParsedPromotion = {
        ...(id ? { id } : {}),
        title,
        description: str(row.description),
        price: num(row.price, "price"),
        original_price: num(row.original_price, "original_price"),
        starts_at: parseDate(row.starts_at),
        ends_at: parseDate(row.ends_at),
        active: row.active === "" || row.active === undefined ? true : bool(row.active),
        display_order: Math.round(num(row.display_order, "display_order") ?? 0),
        image: str(row.image),
        store_ids: parseList(row.store_ids),
        image_filename: str(row.image_filename),
      };
      return out;
    } catch (e) {
      throw new Error(`Ligne ${i + 2}: ${(e as Error).message}`);
    }
  });
}

/**
 * Pour chaque promo sans `image` mais avec `image_filename`, tente de trouver
 * le média correspondant dans `media_assets` (match case-insensitive sur le
 * suffixe du chemin, après le préfixe timestamp éventuel) et renseigne `image`.
 */
export async function autoAssociateImages(
  promos: ParsedPromotion[],
): Promise<{ matched: number; missing: string[] }> {
  const filenames = promos
    .map((p) => p.image_filename)
    .filter((f): f is string => !!f);
  if (filenames.length === 0) return { matched: 0, missing: [] };

  const { data, error } = await supabase
    .from("media_assets")
    .select("path, public_url");
  if (error) throw error;

  const byKey = new Map<string, string>();
  for (const m of data ?? []) {
    const path = (m as { path: string }).path;
    const url = (m as { public_url: string }).public_url;
    const stripped = path.replace(/^\d+-/, "");
    byKey.set(stripped.toLowerCase(), url);
    byKey.set(path.toLowerCase(), url);
  }

  let matched = 0;
  const missing: string[] = [];
  for (const p of promos) {
    if (p.image) continue;
    const fn = p.image_filename;
    if (!fn) continue;
    const url = byKey.get(fn.toLowerCase());
    if (url) {
      p.image = url;
      matched++;
    } else {
      missing.push(fn);
    }
  }
  return { matched, missing };
}

/** Retire les champs non destinés à la table promotions avant upsert. */
export function stripParsedExtras(promos: ParsedPromotion[]): PromoUpsert[] {
  return promos.map(({ image_filename: _ignored, ...rest }) => rest);
}
