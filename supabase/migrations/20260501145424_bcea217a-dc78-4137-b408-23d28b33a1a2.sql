CREATE TABLE public.catalogue_extraction_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catalogue_id uuid,
  page_number integer,
  bbox_ymin integer NOT NULL,
  bbox_xmin integer NOT NULL,
  bbox_ymax integer NOT NULL,
  bbox_xmax integer NOT NULL,
  bbox_width integer GENERATED ALWAYS AS (bbox_xmax - bbox_xmin) STORED,
  bbox_height integer GENERATED ALWAYS AS (bbox_ymax - bbox_ymin) STORED,
  aspect_ratio numeric GENERATED ALWAYS AS (
    CASE WHEN (bbox_ymax - bbox_ymin) > 0
      THEN (bbox_xmax - bbox_xmin)::numeric / (bbox_ymax - bbox_ymin)::numeric
      ELSE NULL END
  ) STORED,
  had_price boolean NOT NULL DEFAULT false,
  had_original_price boolean NOT NULL DEFAULT false,
  category text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_extraction_stats_created ON public.catalogue_extraction_stats(created_at DESC);

ALTER TABLE public.catalogue_extraction_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage extraction stats"
  ON public.catalogue_extraction_stats
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));