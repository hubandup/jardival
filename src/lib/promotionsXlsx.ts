import * as XLSX from "xlsx";
import type { Database } from "@/integrations/supabase/types";

type PromoRow = Database["public"]["Tables"]["promotions"]["Row"];
type PromoUpsert = Database["public"]["Tables"]["promotions"]["Insert"];

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

export async function parsePromotionsFromFile(file: File): Promise<PromoUpsert[]> {
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
      const out: PromoUpsert = {
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
      };
      return out;
    } catch (e) {
      throw new Error(`Ligne ${i + 2}: ${(e as Error).message}`);
    }
  });
}
