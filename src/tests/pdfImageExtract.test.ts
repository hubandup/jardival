// Tests unitaires sur les helpers internes de pdfImageExtract.
// On ne teste PAS l'extraction de bout en bout ici (nécessiterait un PDF synthétique
// + worker pdfjs en jsdom, hors scope) — uniquement la logique mathématique.
//
// Pour vérifier la fonction extractNativeImages contre un vrai PDF Jardival, voir le
// commentaire en bas de fichier.
import { describe, expect, it } from "vitest";

// Re-déclarations locales (mêmes définitions qu'en src/lib/pdfImageExtract.ts).
// On garde les helpers privés en interne pour ne pas polluer l'API publique.
type Mat6 = [number, number, number, number, number, number];
const IDENTITY: Mat6 = [1, 0, 0, 1, 0, 0];

function mulMat(m1: Mat6, m2: Mat6): Mat6 {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2,
  ];
}

function applyMat(m: Mat6, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function imageBboxFromCtm(ctm: Mat6, pageHeight: number) {
  const corners: Array<[number, number]> = [
    applyMat(ctm, 0, 0),
    applyMat(ctm, 1, 0),
    applyMat(ctm, 1, 1),
    applyMat(ctm, 0, 1),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMinPdf = Math.min(...ys);
  const yMaxPdf = Math.max(...ys);
  return {
    x: xMin,
    y: pageHeight - yMaxPdf,
    width: xMax - xMin,
    height: yMaxPdf - yMinPdf,
  };
}

describe("pdfImageExtract math helpers", () => {
  describe("applyMat", () => {
    it("applique l'identité comme noop", () => {
      expect(applyMat(IDENTITY, 5, 7)).toEqual([5, 7]);
    });

    it("applique une translation pure", () => {
      const t: Mat6 = [1, 0, 0, 1, 100, 50];
      expect(applyMat(t, 0, 0)).toEqual([100, 50]);
      expect(applyMat(t, 10, 20)).toEqual([110, 70]);
    });

    it("applique un scale pur", () => {
      const s: Mat6 = [200, 0, 0, 300, 0, 0];
      expect(applyMat(s, 1, 1)).toEqual([200, 300]);
      expect(applyMat(s, 0.5, 0.5)).toEqual([100, 150]);
    });
  });

  describe("mulMat", () => {
    it("identité * M = M", () => {
      const m: Mat6 = [2, 0, 0, 3, 4, 5];
      expect(mulMat(IDENTITY, m)).toEqual(m);
    });

    it("compose deux scales", () => {
      const a: Mat6 = [2, 0, 0, 2, 0, 0]; // x2
      const b: Mat6 = [3, 0, 0, 3, 0, 0]; // x3
      const r = mulMat(a, b);
      expect(r[0]).toBe(6);
      expect(r[3]).toBe(6);
    });
  });

  describe("imageBboxFromCtm", () => {
    it("calcule la bbox en repère top-left pour un CTM scale+translate (cas standard catalogue)", () => {
      // Image 200x300 placée à x=50, y=400 (PDF bottom-left), page 842 pt de haut (A4).
      const ctm: Mat6 = [200, 0, 0, 300, 50, 400];
      const bb = imageBboxFromCtm(ctm, 842);
      expect(bb.x).toBe(50);
      expect(bb.width).toBe(200);
      expect(bb.height).toBe(300);
      // PDF y=400 (bas-gauche du dessin) + height=300 → top en PDF = 700.
      // En top-left : y_top = pageHeight - 700 = 142.
      expect(bb.y).toBe(142);
    });

    it("gère un flip vertical (matrice avec d négatif, fréquent en PDF)", () => {
      // Image dessinée flippée : a=100, d=-100, e=20, f=500.
      const ctm: Mat6 = [100, 0, 0, -100, 20, 500];
      const bb = imageBboxFromCtm(ctm, 842);
      expect(bb.x).toBe(20);
      expect(bb.width).toBe(100);
      expect(bb.height).toBe(100);
      // Coins : (20,500), (120,500), (120,400), (20,400). yMaxPdf=500, yMinPdf=400.
      // y_top = 842 - 500 = 342.
      expect(bb.y).toBe(342);
    });

    it("gère une rotation 90° (matrice b et c non-nuls)", () => {
      // Rotation 90° + scale 100 + translation : la unit-square 1x1 devient un carré 100x100 pivoté.
      const ctm: Mat6 = [0, 100, -100, 0, 200, 100];
      const bb = imageBboxFromCtm(ctm, 842);
      // Coins après transformation : (200,100), (200,200), (100,200), (100,100)
      expect(bb.x).toBe(100);
      expect(bb.width).toBe(100);
      expect(bb.height).toBe(100);
    });
  });
});

// =============================================================================
// Test contre un vrai PDF (manuel)
// =============================================================================
// L'extraction de bout en bout (extractNativeImages) nécessite le worker pdfjs et
// un PDF accessible. Pour mesurer "combien d'images natives par page" sur un PDF
// Jardival réel, exécuter dans la console DevTools du navigateur (admin connecté) :
//
//   import("@/lib/pdfImageExtract").then(async (m) => {
//     const r = await m.extractNativeImages("https://<storage>/catalogues/pdf-XXX.pdf");
//     console.table(r.countsByPage);
//   });
//
// La fonction loggue automatiquement un résumé `[pdfImageExtract] résumé`.
// =============================================================================
