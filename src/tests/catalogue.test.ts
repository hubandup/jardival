import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePromos } from "@/lib/cataloguePromoNormalize";

// Mock supabase BEFORE importing the module that uses it.
const uploadMock = vi.fn();
const getPublicUrlMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      }),
    },
  },
}));

import { uploadAndGetUrl } from "@/lib/storageUpload";
import { analyseBboxEdges } from "@/lib/pdfImageCrop";
import type { Bbox } from "@/types/catalogue";

// =============================================
// Helper : fake canvas avec un buffer de pixels controllable
// (jsdom n'implémente pas getImageData de manière exploitable).
// =============================================
function makeFakeCanvas(
  width: number,
  height: number,
  isNonWhite: (x: number, y: number) => boolean
): HTMLCanvasElement {
  const buffer = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = isNonWhite(x, y) ? 0 : 255;
      buffer[i] = v;
      buffer[i + 1] = v;
      buffer[i + 2] = v;
      buffer[i + 3] = 255;
    }
  }
  return {
    width,
    height,
    getContext: () => ({
      getImageData: (sx: number, sy: number, sw: number, sh: number) => {
        const out = new Uint8ClampedArray(sw * sh * 4);
        for (let yy = 0; yy < sh; yy++) {
          for (let xx = 0; xx < sw; xx++) {
            const srcI = ((sy + yy) * width + (sx + xx)) * 4;
            const dstI = (yy * sw + xx) * 4;
            out[dstI] = buffer[srcI];
            out[dstI + 1] = buffer[srcI + 1];
            out[dstI + 2] = buffer[srcI + 2];
            out[dstI + 3] = buffer[srcI + 3];
          }
        }
        return { data: out, width: sw, height: sh, colorSpace: "srgb" } as ImageData;
      },
    }),
  } as unknown as HTMLCanvasElement;
}

const FULL_BBOX: Bbox = [0, 0, 1000, 1000];

// =============================================
// analyseBboxEdges
// =============================================
describe("analyseBboxEdges", () => {
  it("rapporte isEdgeOnly=false pour une bbox 100% pleine", () => {
    const canvas = makeFakeCanvas(200, 200, () => true);
    const r = analyseBboxEdges(canvas, FULL_BBOX, 0.05);
    expect(r.isEdgeOnly).toBe(false);
  });

  it("rapporte isEdgeOnly=false pour une bbox totalement blanche (pas de signal)", () => {
    const canvas = makeFakeCanvas(200, 200, () => false);
    const r = analyseBboxEdges(canvas, FULL_BBOX, 0.05);
    expect(r.isEdgeOnly).toBe(false);
  });

  it("détecte isEdgeOnly=true quand le contenu non-blanc se concentre sur une bande de bord (<5% surface)", () => {
    const W = 200,
      H = 200;
    // Une fine bande sombre tout à gauche (3% de la largeur), reste blanc.
    const canvas = makeFakeCanvas(W, H, (x) => x < Math.floor(W * 0.03));
    const r = analyseBboxEdges(canvas, FULL_BBOX, 0.05);
    expect(r.isEdgeOnly).toBe(true);
  });

  it("rapporte isEdgeOnly=false pour un produit centré (contenu majoritairement à l'intérieur)", () => {
    const W = 200,
      H = 200;
    const canvas = makeFakeCanvas(W, H, (x, y) => x > 60 && x < 140 && y > 60 && y < 140);
    const r = analyseBboxEdges(canvas, FULL_BBOX, 0.05);
    expect(r.isEdgeOnly).toBe(false);
    expect(r.innerShare).toBeGreaterThan(0.5);
  });

  it("supporte une bbox partielle de la page", () => {
    const canvas = makeFakeCanvas(400, 400, (x, y) => x > 200 && x < 300 && y > 200 && y < 300);
    // Bbox côté droit-bas qui contient le carré : doit être pleine, pas edge-only.
    const r = analyseBboxEdges(canvas, [400, 400, 800, 800], 0.05);
    expect(r.isEdgeOnly).toBe(false);
  });
});

// =============================================
// normalizePromos
// =============================================
describe("normalizePromos", () => {
  it("retourne un tableau vide pour une entrée vide", () => {
    expect(normalizePromos([])).toEqual([]);
  });

  it("supprime les promos sans titre exploitable", () => {
    const result = normalizePromos([
      { title: "" },
      { title: "   " },
      { title: undefined },
      { title: "Vrai produit" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Vrai produit");
  });

  it("trim les titres et descriptions", () => {
    const result = normalizePromos([
      { title: "  Tondeuse  ", description: "  Électrique  " },
    ]);
    expect(result[0].title).toBe("Tondeuse");
    expect(result[0].description).toBe("Électrique");
  });

  it("retombe sur la catégorie quand la description est vide", () => {
    const result = normalizePromos([
      { title: "X", description: "", category: "Outils" },
    ]);
    expect(result[0].description).toBe("Outils");
  });

  it("calcule discount_percent automatiquement quand orig > price et discount manquant", () => {
    const result = normalizePromos([
      { title: "X", price: 80, original_price: 100 },
    ]);
    expect(result[0].discount_percent).toBe(20);
  });

  it("respecte un discount_percent fourni explicitement", () => {
    const result = normalizePromos([
      { title: "X", price: 80, original_price: 100, discount_percent: 25 },
    ]);
    expect(result[0].discount_percent).toBe(25);
  });

  it("ne calcule pas de discount si price=0 (offre sans prix unitaire)", () => {
    const result = normalizePromos([
      { title: "X", price: 0, original_price: 100 },
    ]);
    expect(result[0].discount_percent).toBeNull();
  });

  it("normalise un price NaN/non-numérique en 0", () => {
    const result = normalizePromos([
      { title: "X", price: NaN as unknown as number },
      { title: "Y", price: undefined },
    ]);
    expect(result[0].price).toBe(0);
    expect(result[1].price).toBe(0);
  });

  it("rejette une bbox malformée", () => {
    const result = normalizePromos([
      { title: "X", bbox_2d: [1, 2, 3] },
      { title: "Y", bbox_2d: ["a", 1, 2, 3] },
      { title: "Z", bbox_2d: [10, 20, 30, 40] },
    ]);
    expect(result[0].bbox_2d).toBeNull();
    expect(result[1].bbox_2d).toBeNull();
    expect(result[2].bbox_2d).toEqual([10, 20, 30, 40]);
  });

  it("accepte les positions valides et rejette les invalides", () => {
    const result = normalizePromos([
      { title: "A", position: "haut-gauche" },
      { title: "B", position: "milieu-centre" },
      { title: "C", position: "INVALID" },
      { title: "D", position: 42 as unknown as string },
      { title: "E" },
    ]);
    expect(result[0].position).toBe("haut-gauche");
    expect(result[1].position).toBe("milieu-centre");
    expect(result[2].position).toBeNull();
    expect(result[3].position).toBeNull();
    expect(result[4].position).toBeNull();
  });
});

// =============================================
// uploadAndGetUrl
// =============================================
describe("uploadAndGetUrl", () => {
  beforeEach(() => {
    uploadMock.mockReset();
    getPublicUrlMock.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retourne le publicUrl quand l'upload réussit", async () => {
    uploadMock.mockResolvedValueOnce({ error: null });
    getPublicUrlMock.mockReturnValueOnce({
      data: { publicUrl: "https://cdn.test/x.jpg" },
    });
    const file = new Blob(["hello"], { type: "image/jpeg" }) as unknown as File;
    const url = await uploadAndGetUrl("promo-images", "p/1.jpg", file, {
      contentType: "image/jpeg",
    });
    expect(url).toBe("https://cdn.test/x.jpg");
    expect(uploadMock).toHaveBeenCalledWith("p/1.jpg", file, { contentType: "image/jpeg" });
  });

  it("appelle upload sans options si contentType absent", async () => {
    uploadMock.mockResolvedValueOnce({ error: null });
    getPublicUrlMock.mockReturnValueOnce({ data: { publicUrl: "https://x" } });
    const blob = new Blob(["a"]) as unknown as File;
    await uploadAndGetUrl("catalogues", "p.pdf", blob);
    expect(uploadMock).toHaveBeenCalledWith("p.pdf", blob, undefined);
  });

  it("propage l'erreur supabase et n'appelle pas getPublicUrl", async () => {
    const fakeErr = new Error("storage offline");
    uploadMock.mockResolvedValueOnce({ error: fakeErr });
    const blob = new Blob(["a"]) as unknown as File;
    await expect(uploadAndGetUrl("b", "p", blob)).rejects.toThrow("storage offline");
    expect(getPublicUrlMock).not.toHaveBeenCalled();
  });
});
