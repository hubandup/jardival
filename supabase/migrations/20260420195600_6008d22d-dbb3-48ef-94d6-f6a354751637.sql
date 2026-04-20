
-- Backfill: set media_assets.title (and alt if empty) from associated product/promotion/store name
UPDATE public.media_assets ma
SET title = p.name,
    alt = COALESCE(NULLIF(ma.alt, ''), p.name)
FROM public.products p
WHERE (p.image = ma.public_url OR ma.public_url = ANY(p.images))
  AND (ma.title IS NULL OR ma.title = '' OR ma.title <> p.name);

UPDATE public.media_assets ma
SET title = pr.title,
    alt = COALESCE(NULLIF(ma.alt, ''), pr.title)
FROM public.promotions pr
WHERE pr.image = ma.public_url
  AND (ma.title IS NULL OR ma.title = '' OR ma.title <> pr.title);

UPDATE public.media_assets ma
SET title = s.name,
    alt = COALESCE(NULLIF(ma.alt, ''), s.name)
FROM public.stores s
WHERE s.image = ma.public_url
  AND (ma.title IS NULL OR ma.title = '' OR ma.title <> s.name);

-- Function to auto-set media_assets.title from related entity on insert/update
CREATE OR REPLACE FUNCTION public.media_assets_set_title_from_entity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entity_name text;
BEGIN
  -- Try product first
  SELECT name INTO entity_name FROM public.products
   WHERE image = NEW.public_url OR NEW.public_url = ANY(images)
   LIMIT 1;

  IF entity_name IS NULL THEN
    SELECT title INTO entity_name FROM public.promotions
     WHERE image = NEW.public_url
     LIMIT 1;
  END IF;

  IF entity_name IS NULL THEN
    SELECT name INTO entity_name FROM public.stores
     WHERE image = NEW.public_url
     LIMIT 1;
  END IF;

  IF entity_name IS NOT NULL THEN
    NEW.title := entity_name;
    IF NEW.alt IS NULL OR NEW.alt = '' THEN
      NEW.alt := entity_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_assets_title_from_entity ON public.media_assets;
CREATE TRIGGER trg_media_assets_title_from_entity
BEFORE INSERT OR UPDATE OF public_url ON public.media_assets
FOR EACH ROW
EXECUTE FUNCTION public.media_assets_set_title_from_entity();
