import * as XLSX from "xlsx";
import type { Database } from "@/integrations/supabase/types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductUpsert = Database["public"]["Tables"]["products"]["Insert"];

const COLUMNS = [
  "id",
  "ref",
  "name",
  "category",
  "description",
  "price",
  "old_price",
  "discount",
  "is_new",
  "active",
  "display_order",
  "image",
  "images",
] as const;

function toCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.join(" | ");
  if (typeof value === "object") return JSON.stringify(value);
  return value as string | number | boolean;
}

export function exportProductsToXlsx(products: ProductRow[]): void {
  const rows = products.map((p) => {
    const row: Record<string, unknown> = {};
    for (const key of COLUMNS) row[key] = toCell((p as any)[key]);
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: [...COLUMNS] });
  (ws as any)["!cols"] = [
    { wch: 36 }, { wch: 14 }, { wch: 36 }, { wch: 24 }, { wch: 40 },
    { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 8 }, { wch: 50 }, { wch: 60 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produits");
  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `jardival-produits-${today}.xlsx`);
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
  if (raw === null || raw === undefined || raw === "") return false;
  const s = String(raw).trim().toLowerCase();
  return s === "true" || s === "1" || s === "oui" || s === "yes";
}

function parseImages(raw: unknown): string[] | null {
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

export async function parseProductsFromFile(file: File): Promise<ProductUpsert[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Le fichier ne contient aucune feuille");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  if (rows.length === 0) throw new Error("Le fichier est vide");

  return rows.map((row, i) => {
    try {
      const name = str(row.name);
      if (!name) throw new Error("name requis");
      const id = str(row.id);
      const out: ProductUpsert = {
        ...(id ? { id } : {}),
        ref: str(row.ref),
        name,
        category: str(row.category),
        description: str(row.description),
        price: num(row.price, "price"),
        old_price: num(row.old_price, "old_price"),
        discount: Math.round(num(row.discount, "discount") ?? 0),
        is_new: bool(row.is_new),
        active: row.active === "" || row.active === undefined ? true : bool(row.active),
        display_order: Math.round(num(row.display_order, "display_order") ?? 0),
        image: str(row.image),
        images: parseImages(row.images),
      };
      return out;
    } catch (e) {
      throw new Error(`Ligne ${i + 2}: ${(e as Error).message}`);
    }
  });
}
