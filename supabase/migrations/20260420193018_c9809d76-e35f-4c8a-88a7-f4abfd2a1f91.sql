-- 1. Add slug column
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS slug text;

-- 2. Backfill from city (fallback to id) with uniqueness
WITH ranked AS (
  SELECT
    id,
    public.slugify(COALESCE(NULLIF(city, ''), id)) AS base,
    ROW_NUMBER() OVER (
      PARTITION BY public.slugify(COALESCE(NULLIF(city, ''), id))
      ORDER BY created_at
    ) AS rn
  FROM public.stores
)
UPDATE public.stores s
SET slug = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || r.rn END
FROM ranked r
WHERE s.id = r.id AND (s.slug IS NULL OR s.slug = '');

-- 3. Unique index
CREATE UNIQUE INDEX IF NOT EXISTS stores_slug_key ON public.stores(slug);

-- 4. Trigger to auto-generate slug on insert/update if missing
CREATE OR REPLACE FUNCTION public.stores_set_slug()
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
    base := public.slugify(COALESCE(NULLIF(NEW.city, ''), NEW.id));
    IF base = '' THEN base := 'magasin'; END IF;
    candidate := base;
    WHILE EXISTS (
      SELECT 1 FROM public.stores WHERE slug = candidate AND id <> NEW.id
    ) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stores_set_slug ON public.stores;
CREATE TRIGGER trg_stores_set_slug
BEFORE INSERT OR UPDATE OF city, slug ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.stores_set_slug();