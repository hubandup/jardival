// Types partagés du workflow d'extraction de catalogues PDF.

export type Bbox = [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0..1000

export interface WorkflowPromo {
  title: string;
  description?: string | null;
  price?: number | null;
  original_price?: number | null;
  discount_percent?: number | null;
  category?: string | null;
  page_number?: number | null;
  bbox_2d?: Bbox | null;
  image_url?: string | null;
  image_cutout_url?: string | null;
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
