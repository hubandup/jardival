import * as XLSX from "xlsx";
import type { Database } from "@/integrations/supabase/types";

type StoreRow = Database["public"]["Tables"]["stores"]["Row"];
type StoreUpsert = Database["public"]["Tables"]["stores"]["Insert"];

const COLUMNS = [
  "id",
  "name",
  "address",
  "postal_code",
  "city",
  "department",
  "phone",
  "latitude",
  "longitude",
  "image",
  "services",
  "hours",
] as const;

function toCell(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.join(" | ");
  if (typeof value === "object") return JSON.stringify(value);
  return value as string | number;
}

export function exportStoresToXlsx(stores: StoreRow[]): void {
  const rows = stores.map((s) => {
    const row: Record<string, unknown> = {};
    for (const key of COLUMNS) row[key] = toCell((s as any)[key]);
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: [...COLUMNS] });
  // Column widths
  (ws as any)["!cols"] = [
    { wch: 14 }, { wch: 30 }, { wch: 40 }, { wch: 10 }, { wch: 20 },
    { wch: 6 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 40 },
    { wch: 40 }, { wch: 60 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Magasins");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `jardival-magasins-${today}.xlsx`);
}

function parseServices(raw: unknown): string[] | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  // Try JSON first
  if (s.startsWith("[")) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.map(String).map((x) => x.trim()).filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  return s.split("|").map((x) => x.trim()).filter(Boolean);
}

function parseHours(raw: unknown): unknown {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`horaires JSON invalides: ${s.slice(0, 40)}…`);
  }
}

function parseNumber(raw: unknown, field: string, required = true): number | null {
  if (raw === null || raw === undefined || raw === "") {
    if (required) throw new Error(`${field} requis`);
    return null;
  }
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
  if (Number.isNaN(n)) throw new Error(`${field} invalide: ${raw}`);
  return n;
}

function str(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

export interface ParsedStore extends StoreUpsert {}

export async function parseStoresFromFile(file: File): Promise<ParsedStore[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Le fichier ne contient aucune feuille");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  if (rows.length === 0) throw new Error("Le fichier est vide");

  return rows.map((row, i) => {
    try {
      const id = str(row.id);
      const name = str(row.name);
      const address = str(row.address);
      const city = str(row.city);
      const department = str(row.department);

      if (!id) throw new Error("id requis");
      if (!name) throw new Error("name requis");
      if (!address) throw new Error("address requis");
      if (!city) throw new Error("city requis");
      if (!department) throw new Error("department requis");

      return {
        id,
        name,
        address,
        postal_code: str(row.postal_code),
        city,
        department,
        phone: str(row.phone),
        latitude: parseNumber(row.latitude, "latitude")!,
        longitude: parseNumber(row.longitude, "longitude")!,
        image: str(row.image),
        services: parseServices(row.services),
        hours: parseHours(row.hours) as any,
      };
    } catch (e) {
      throw new Error(`Ligne ${i + 2}: ${(e as Error).message}`);
    }
  });
}
