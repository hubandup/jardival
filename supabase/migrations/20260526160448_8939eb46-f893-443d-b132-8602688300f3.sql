ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS image_urls jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS page_number int,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS extra_fields jsonb DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_status_check'
  ) THEN
    ALTER TABLE public.promotions ADD CONSTRAINT promotions_status_check CHECK (status IN ('published','draft'));
  END IF;
END $$;

ALTER TABLE public.catalogues
  ADD COLUMN IF NOT EXISTS xlsx_url text,
  ADD COLUMN IF NOT EXISTS import_method text DEFAULT 'pdf';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catalogues_import_method_check'
  ) THEN
    ALTER TABLE public.catalogues ADD CONSTRAINT catalogues_import_method_check CHECK (import_method IN ('pdf','xlsx'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_promotions_status_published ON public.promotions(status) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_promotions_catalogue_status ON public.promotions(catalogue_id, status);
CREATE INDEX IF NOT EXISTS idx_promotions_extra_fields ON public.promotions USING GIN (extra_fields);