
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS hero_featured boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_promotions_hero_featured ON public.promotions(hero_featured) WHERE hero_featured = true;

CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site settings public read"
  ON public.site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage site settings"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

INSERT INTO public.site_settings (key, value) VALUES ('hero_mode', '"random"'::jsonb)
  ON CONFLICT (key) DO NOTHING;
