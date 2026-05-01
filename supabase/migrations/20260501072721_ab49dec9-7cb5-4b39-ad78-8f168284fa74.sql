
ALTER TABLE public.promotions
ADD COLUMN IF NOT EXISTS catalogue_id uuid REFERENCES public.catalogues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_promotions_catalogue_id ON public.promotions(catalogue_id);
