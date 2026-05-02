// Types partagés du workflow d'extraction de catalogues PDF.

export type Bbox = [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0..1000

export const POSITION_ZONES = [
  "haut-gauche",
  "haut-centre",
  "haut-droite",
  "milieu-gauche",
  "milieu-centre",
  "milieu-droite",
  "bas-gauche",
  "bas-centre",
  "bas-droite",
] as const;
export type PositionZone = (typeof POSITION_ZONES)[number];

export interface WorkflowPromo {
  title: string;
  description?: string | null;
  price?: number | null;
  original_price?: number | null;
  discount_percent?: number | null;
  category?: string | null;
  page_number?: number | null;
  /** Zone de page renvoyée par Gemini (grille 3×3). Sert au matching avec les images natives. */
  position?: PositionZone | null;
  /** Bbox visuelle (legacy : utilisée pour le crop de fallback ou l'édition manuelle). */
  bbox_2d?: Bbox | null;
  image_url?: string | null;
  image_cutout_url?: string | null;
  /** Provenance de l'image_url :
   *  - "native" : image extraite directement du PDF (qualité HD, via service Render)
   *  - "fallback-crop" : crop d'une page rasterisée (legacy, qualité dégradée)
   *  - "manual" : image uploadée manuellement par l'admin
   *  - null : pas encore d'image */
  image_source?: "native" | "fallback-crop" | "manual" | null;
  /** Score de matching renvoyé par le service Python (match_distance). */
  match_score?: number | null;
  /** Méthode de matching utilisée ("native", "fallback", ...). */
  match_method?: string | null;
  /** True si l'image a été rasterisée (pas extraite nativement du PDF). */
  is_rasterized?: boolean | null;
  selected?: boolean;
}

export interface PreviewBox {
  pageNumber: number;
  bbox: Bbox;
  index: number; // index humain (1-based)
  label: string;
  subLabel?: string;
  selected: boolean;
  price?: number | null;
  originalPrice?: number | null;
  description?: string | null;
  imageUrl?: string | null;
}

export interface PreviewTextPatch {
  title?: string;
  price?: number | null;
  original_price?: number | null;
  description?: string | null;
}
