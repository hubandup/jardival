// Associe chaque promo (description textuelle + zone 3×3) à l'image native du PDF
// la plus proche sur la même page. La matching est entièrement géométrique :
// distance euclidienne entre le centre de la zone décrite par Gemini et le centre
// de chaque image native, en coordonnées normalisées [0..1] de la page.
//
// Allocation : chaque image native ne peut être assignée qu'à UNE seule promo
// (greedy, par distance croissante) — évite que la même photo soit attribuée à
// deux produits voisins.
import type { PositionZone, WorkflowPromo } from "@/types/catalogue";
import type { NativePageImage } from "@/lib/pdfImageExtract";

export interface PromoImageMatch {
  promoIndex: number;
  imageIndex: number | null;
  /** Distance normalisée (0 = collés, ~1.4 = coins opposés). null si pas matché. */
  distance: number | null;
}

export interface MatchResult {
  matches: PromoImageMatch[];
  unmatchedPromoIndexes: number[];
  unusedImageIndexes: number[];
}

// Centre de chaque zone 3×3 en coordonnées normalisées [0..1].
// x : colonne (gauche=1/6, centre=1/2, droite=5/6).
// y : ligne (haut=1/6, milieu=1/2, bas=5/6) — repère TOP-LEFT.
const ZONE_CENTERS: Record<PositionZone, { x: number; y: number }> = {
  "haut-gauche": { x: 1 / 6, y: 1 / 6 },
  "haut-centre": { x: 1 / 2, y: 1 / 6 },
  "haut-droite": { x: 5 / 6, y: 1 / 6 },
  "milieu-gauche": { x: 1 / 6, y: 1 / 2 },
  "milieu-centre": { x: 1 / 2, y: 1 / 2 },
  "milieu-droite": { x: 5 / 6, y: 1 / 2 },
  "bas-gauche": { x: 1 / 6, y: 5 / 6 },
  "bas-centre": { x: 1 / 2, y: 5 / 6 },
  "bas-droite": { x: 5 / 6, y: 5 / 6 },
};

/**
 * @param minImageAreaRatio Seuil minimum (0..1) pour considérer une image comme
 * candidate. Par défaut 0.005 (0.5% de la page) pour exclure les pictos / icônes.
 */
export function matchImagesToPromos(
  promos: WorkflowPromo[],
  images: NativePageImage[],
  pageDimensions: Record<number, { width: number; height: number }>,
  options: { minImageAreaRatio?: number } = {}
): MatchResult {
  const minAreaRatio = options.minImageAreaRatio ?? 0.005;

  // Pré-calcule le centre normalisé de chaque image et son aire relative.
  const imageMeta = images.map((img) => {
    const dims = pageDimensions[img.pageNumber];
    if (!dims || dims.width <= 0 || dims.height <= 0) {
      return null;
    }
    const cx = (img.x + img.width / 2) / dims.width;
    const cy = (img.y + img.height / 2) / dims.height;
    const area = (img.width * img.height) / (dims.width * dims.height);
    return { pageNumber: img.pageNumber, cx, cy, area };
  });

  // Construit toutes les paires éligibles (promo, image) avec leur distance.
  type Candidate = { promoIndex: number; imageIndex: number; distance: number };
  const candidates: Candidate[] = [];

  promos.forEach((promo, promoIndex) => {
    if (!promo.position || !promo.page_number) return;
    const zone = ZONE_CENTERS[promo.position];
    if (!zone) return;
    imageMeta.forEach((meta, imageIndex) => {
      if (!meta) return;
      if (meta.pageNumber !== promo.page_number) return;
      if (meta.area < minAreaRatio) return;
      const dx = meta.cx - zone.x;
      const dy = meta.cy - zone.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      candidates.push({ promoIndex, imageIndex, distance });
    });
  });

  // Greedy : trie par distance croissante, prend la 1ʳᵉ paire libre, etc.
  candidates.sort((a, b) => a.distance - b.distance);
  const usedImages = new Set<number>();
  const matchedPromos = new Map<number, { imageIndex: number; distance: number }>();
  for (const c of candidates) {
    if (matchedPromos.has(c.promoIndex)) continue;
    if (usedImages.has(c.imageIndex)) continue;
    matchedPromos.set(c.promoIndex, { imageIndex: c.imageIndex, distance: c.distance });
    usedImages.add(c.imageIndex);
  }

  const matches: PromoImageMatch[] = promos.map((_, promoIndex) => {
    const m = matchedPromos.get(promoIndex);
    return m
      ? { promoIndex, imageIndex: m.imageIndex, distance: m.distance }
      : { promoIndex, imageIndex: null, distance: null };
  });

  const unmatchedPromoIndexes = matches
    .filter((m) => m.imageIndex === null)
    .map((m) => m.promoIndex);
  const unusedImageIndexes = images
    .map((_, i) => i)
    .filter((i) => !usedImages.has(i));

  return { matches, unmatchedPromoIndexes, unusedImageIndexes };
}

// Export pour les tests.
export const __ZONE_CENTERS = ZONE_CENTERS;
