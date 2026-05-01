import { describe, expect, it } from "vitest";
import { matchImagesToPromos } from "@/lib/matchPromosToImages";
import type { NativePageImage } from "@/lib/pdfImageExtract";
import type { WorkflowPromo } from "@/types/catalogue";

const PAGE_DIMS = {
  1: { width: 600, height: 800 },
  2: { width: 600, height: 800 },
};

function makeImage(overrides: Partial<NativePageImage>): NativePageImage {
  return {
    pageNumber: 1,
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    naturalWidth: 1000,
    naturalHeight: 1000,
    blob: new Blob([], { type: "image/jpeg" }),
    objId: "img1",
    source: "xobject",
    ...overrides,
  };
}

function promo(p: Partial<WorkflowPromo>): WorkflowPromo {
  return { title: "X", ...p };
}

describe("matchImagesToPromos", () => {
  it("matche une promo `haut-gauche` avec l'image située en haut-gauche de la page", () => {
    // Page 600×800. Centres de zones (haut-gauche) : x=100, y=133.
    const images = [
      // Image en haut-gauche : centre (100, 133)
      makeImage({ x: 0, y: 33, width: 200, height: 200 }),
      // Image en bas-droite : centre (500, 666)
      makeImage({ x: 400, y: 566, width: 200, height: 200, objId: "img2" }),
    ];
    const promos = [promo({ page_number: 1, position: "haut-gauche" })];
    const r = matchImagesToPromos(promos, images, PAGE_DIMS);
    expect(r.matches[0].imageIndex).toBe(0);
    expect(r.unmatchedPromoIndexes).toEqual([]);
  });

  it("matche par page (n'utilise pas une image d'une autre page)", () => {
    const images = [
      makeImage({ pageNumber: 2, x: 0, y: 0, width: 200, height: 200 }),
    ];
    const promos = [promo({ page_number: 1, position: "haut-gauche" })];
    const r = matchImagesToPromos(promos, images, PAGE_DIMS);
    expect(r.matches[0].imageIndex).toBeNull();
    expect(r.unmatchedPromoIndexes).toEqual([0]);
  });

  it("alloue chaque image à au plus une promo (greedy par distance)", () => {
    // Une seule image disponible, deux promos sur la même zone.
    // La promo la plus proche doit gagner ; l'autre reste sans image.
    const images = [makeImage({ x: 100, y: 100, width: 200, height: 200 })];
    const promos = [
      promo({ page_number: 1, position: "haut-gauche" }),
      promo({ page_number: 1, position: "haut-gauche" }),
    ];
    const r = matchImagesToPromos(promos, images, PAGE_DIMS);
    const matched = r.matches.filter((m) => m.imageIndex !== null);
    expect(matched).toHaveLength(1);
    expect(r.unmatchedPromoIndexes).toHaveLength(1);
  });

  it("ignore les images plus petites que minImageAreaRatio (filtre picto)", () => {
    // Page 600×800 = 480 000. Seuil 0.5% = 2400.
    // Image 30×30 = 900 → filtrée.
    const images = [makeImage({ x: 80, y: 120, width: 30, height: 30 })];
    const promos = [promo({ page_number: 1, position: "haut-gauche" })];
    const r = matchImagesToPromos(promos, images, PAGE_DIMS);
    expect(r.matches[0].imageIndex).toBeNull();
  });

  it("ne matche pas les promos sans position ni page_number", () => {
    const images = [makeImage({ x: 0, y: 0, width: 200, height: 200 })];
    const promos = [
      promo({ page_number: 1 }), // pas de position
      promo({ position: "haut-gauche" }), // pas de page_number
    ];
    const r = matchImagesToPromos(promos, images, PAGE_DIMS);
    expect(r.matches[0].imageIndex).toBeNull();
    expect(r.matches[1].imageIndex).toBeNull();
    expect(r.unusedImageIndexes).toEqual([0]);
  });

  it("préfère l'image la plus proche du centre de la zone parmi plusieurs candidates", () => {
    // Zone milieu-centre : centre (300, 400).
    // Image A : centre (350, 450) → distance ≈ 0.103
    // Image B : centre (550, 100) → distance ≈ 0.473
    const images = [
      makeImage({ objId: "A", x: 250, y: 350, width: 200, height: 200 }),
      makeImage({ objId: "B", x: 450, y: 0, width: 200, height: 200 }),
    ];
    const promos = [promo({ page_number: 1, position: "milieu-centre" })];
    const r = matchImagesToPromos(promos, images, PAGE_DIMS);
    expect(r.matches[0].imageIndex).toBe(0);
  });

  it("rapporte les images inutilisées", () => {
    const images = [
      makeImage({ x: 0, y: 0, width: 200, height: 200 }),
      makeImage({ x: 400, y: 600, width: 200, height: 200, objId: "img2" }),
    ];
    const promos = [promo({ page_number: 1, position: "haut-gauche" })];
    const r = matchImagesToPromos(promos, images, PAGE_DIMS);
    expect(r.unusedImageIndexes).toEqual([1]);
  });
});
