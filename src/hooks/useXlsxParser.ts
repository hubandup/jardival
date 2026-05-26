import * as XLSX from "xlsx";

export const MEDIA_BASE_URL =
  "https://nwqhzsjajjluvwrbaemw.supabase.co/storage/v1/object/public/media/";

const FORBIDDEN_EXT = ["tiff", "tif", "psd"];
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp", "gif", "svg"];

// Excel column letter -> 0-based index
export function colToIdx(col: string): number {
  let n = 0;
  for (const c of col.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

const NATIVE_COLS = {
  external_id: "A",
  page_number: "B",
  display_order: "C",
  reference: "E",
  title: "F",
  original_price: "K",
  description: "M",
  price: "N",
} as const;

const MEDIA_COLS = ["Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG"];

const EXTRA_COLS = [
  "D", "I", "J", "L", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y",
  "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP",
];

function snake(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function processMedia(row: any[]): { urls: string[]; status: "published" | "draft" } {
  const urls: string[] = [];
  for (const col of MEDIA_COLS) {
    const raw = row[colToIdx(col)];
    const filename = (raw == null ? "" : String(raw)).trim();
    if (!filename) continue;
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (FORBIDDEN_EXT.includes(ext)) continue;
    if (!ALLOWED_EXT.includes(ext)) continue;
    urls.push(MEDIA_BASE_URL + filename);
  }
  return { urls, status: urls.length === 0 ? "draft" : "published" };
}

function toNumber(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/\s/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function toInt(v: any): number | null {
  const n = toNumber(v);
  return n == null ? null : Math.round(n);
}

export interface ParsedPromo {
  rowIndex: number;
  title: string;
  description: string | null;
  price: number | null;
  original_price: number | null;
  page_number: number | null;
  display_order: number | null;
  reference: string | null;
  external_id: string | null;
  image_url: string | null;
  image_urls: string[];
  status: "published" | "draft";
  extra_fields: Record<string, any>;
  // UI flags
  warnings: string[];
}

export interface ParseResult {
  promos: ParsedPromo[];
  headers: string[];
  totalRows: number;
  publishedCount: number;
  draftCount: number;
  suggestedTitle: string | null;
}

export async function parseXlsxFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null, raw: true });

  // B2 suggested title
  const suggestedTitle =
    aoa[1] && aoa[1][1] != null && String(aoa[1][1]).trim() !== ""
      ? String(aoa[1][1]).trim()
      : null;

  const headerRow = aoa[3] || [];
  const headers = headerRow.map((h: any) => (h == null ? "" : String(h)));

  const titleIdx = colToIdx(NATIVE_COLS.title);
  const promos: ParsedPromo[] = [];

  for (let r = 4; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const titleVal = row[titleIdx];
    if (titleVal == null || String(titleVal).trim() === "") break;

    const media = processMedia(row);

    const extra: Record<string, any> = {};
    for (const col of EXTRA_COLS) {
      const idx = colToIdx(col);
      const label = headers[idx] || col;
      const key = snake(label) || col.toLowerCase();
      const v = row[idx];
      extra[key] = v == null || v === "" ? null : v;
    }

    const warnings: string[] = [];
    if (media.status === "draft") warnings.push("Aucune image valide (jpg/png/webp)");

    promos.push({
      rowIndex: r + 1,
      title: String(titleVal).trim(),
      description: row[colToIdx(NATIVE_COLS.description)]
        ? String(row[colToIdx(NATIVE_COLS.description)])
        : null,
      price: toNumber(row[colToIdx(NATIVE_COLS.price)]),
      original_price: toNumber(row[colToIdx(NATIVE_COLS.original_price)]),
      page_number: toInt(row[colToIdx(NATIVE_COLS.page_number)]),
      display_order: toInt(row[colToIdx(NATIVE_COLS.display_order)]),
      reference: row[colToIdx(NATIVE_COLS.reference)]
        ? String(row[colToIdx(NATIVE_COLS.reference)]).trim()
        : null,
      external_id: row[colToIdx(NATIVE_COLS.external_id)]
        ? String(row[colToIdx(NATIVE_COLS.external_id)]).trim()
        : null,
      image_url: media.urls[0] || null,
      image_urls: media.urls,
      status: media.status,
      extra_fields: extra,
      warnings,
    });
  }

  return {
    promos,
    headers,
    totalRows: promos.length,
    publishedCount: promos.filter((p) => p.status === "published").length,
    draftCount: promos.filter((p) => p.status === "draft").length,
    suggestedTitle,
  };
}
