-- Champs de matching/extraction renseignés par l'edge function
-- `extract-catalogue-promos` à partir de la réponse du service Render
-- (`/extract`) : score IoU/centroïde, méthode utilisée, et marqueur indiquant
-- si l'image a dû être rasterisée (Poppler+PyMuPDF ont échoué).
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS match_score numeric,
  ADD COLUMN IF NOT EXISTS match_method text,
  ADD COLUMN IF NOT EXISTS is_rasterized boolean NOT NULL DEFAULT false;

-- Contrainte de cohérence : seules les valeurs émises par `image_matcher`
-- (ou NULL quand le match a échoué) sont acceptées. À étendre si on ajoute
-- une 3e méthode de matching plus tard.
ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_match_method_check;
ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_match_method_check
  CHECK (match_method IS NULL OR match_method IN ('iou', 'centroid'));
