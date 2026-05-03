-- 1. Nettoyer les promotions orphelines
DELETE FROM public.promotions
WHERE catalogue_id IS NOT NULL
  AND catalogue_id NOT IN (SELECT id FROM public.catalogues);

-- 2. Supprimer une éventuelle FK existante puis la recréer avec ON DELETE CASCADE
ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_catalogue_id_fkey;

ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_catalogue_id_fkey
  FOREIGN KEY (catalogue_id)
  REFERENCES public.catalogues(id)
  ON DELETE CASCADE;