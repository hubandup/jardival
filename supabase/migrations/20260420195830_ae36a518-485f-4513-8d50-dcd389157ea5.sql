
UPDATE public.media_assets ma
SET alt = p.name
FROM public.products p
WHERE (p.image = ma.public_url OR ma.public_url = ANY(p.images))
  AND (ma.alt IS NULL OR ma.alt = '');

UPDATE public.media_assets ma
SET alt = pr.title
FROM public.promotions pr
WHERE pr.image = ma.public_url
  AND (ma.alt IS NULL OR ma.alt = '');

UPDATE public.media_assets ma
SET alt = s.name
FROM public.stores s
WHERE s.image = ma.public_url
  AND (ma.alt IS NULL OR ma.alt = '');
