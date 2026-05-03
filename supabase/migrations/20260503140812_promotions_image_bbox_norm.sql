-- Bbox normalisée [0,1] (x, y, w, h, origine top-left) de l'image native
-- matchée à chaque promo, telle que renvoyée par le service Render. Permet
-- au frontend de redessiner l'overlay preview au reload sans avoir à
-- réappeler /extract.
--
-- Stockée en jsonb pour rester souple : un array de 4 numbers est valide,
-- null aussi quand aucune image n'a été matchée.
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS image_bbox_norm jsonb;
