UPDATE public.promotions
SET active = false
WHERE active = true
  AND (image IS NULL OR image = '')
  AND (image_urls IS NULL OR jsonb_array_length(image_urls) = 0);