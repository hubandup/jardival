-- 1. Add slug column
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS slug text;

-- 2. Backfill from title with uniqueness handling
WITH ranked AS (
  SELECT
    id,
    public.slugify(COALESCE(NULLIF(title, ''), id::text)) AS base,
    ROW_NUMBER() OVER (
      PARTITION BY public.slugify(COALESCE(NULLIF(title, ''), id::text))
      ORDER BY created_at
    ) AS rn
  FROM public.promotions
)
UPDATE public.promotions p
SET slug = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || r.rn END
FROM ranked r
WHERE p.id = r.id AND (p.slug IS NULL OR p.slug = '');

-- 3. Unique index
CREATE UNIQUE INDEX IF NOT EXISTS promotions_slug_key ON public.promotions(slug);

-- 4. Trigger to auto-generate slug
CREATE OR REPLACE FUNCTION public.promotions_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := public.slugify(COALESCE(NULLIF(NEW.title, ''), NEW.id::text));
    IF base = '' THEN base := 'promotion'; END IF;
    candidate := base;
    WHILE EXISTS (
      SELECT 1 FROM public.promotions WHERE slug = candidate AND id <> NEW.id
    ) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promotions_set_slug ON public.promotions;
CREATE TRIGGER trg_promotions_set_slug
BEFORE INSERT OR UPDATE OF title, slug ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.promotions_set_slug();