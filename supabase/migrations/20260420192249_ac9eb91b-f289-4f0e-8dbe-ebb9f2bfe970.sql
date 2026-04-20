-- Enable accent-removal first
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1. Add slug column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text;

-- 2. Slugify helper
CREATE OR REPLACE FUNCTION public.slugify(_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(public.unaccent(coalesce(_text, ''))),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- 3. Backfill existing rows with unique slugs
WITH ranked AS (
  SELECT
    id,
    public.slugify(name) AS base,
    ROW_NUMBER() OVER (PARTITION BY public.slugify(name) ORDER BY created_at) AS rn
  FROM public.products
)
UPDATE public.products p
SET slug = CASE WHEN r.rn = 1 THEN r.base ELSE r.base || '-' || r.rn END
FROM ranked r
WHERE p.id = r.id AND (p.slug IS NULL OR p.slug = '');

-- 4. Unique index
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products(slug);

-- 5. Trigger to auto-generate slug on insert/update if missing
CREATE OR REPLACE FUNCTION public.products_set_slug()
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
    base := public.slugify(NEW.name);
    IF base = '' THEN base := 'produit'; END IF;
    candidate := base;
    WHILE EXISTS (
      SELECT 1 FROM public.products WHERE slug = candidate AND id <> NEW.id
    ) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_set_slug ON public.products;
CREATE TRIGGER trg_products_set_slug
BEFORE INSERT OR UPDATE OF name, slug ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_set_slug();