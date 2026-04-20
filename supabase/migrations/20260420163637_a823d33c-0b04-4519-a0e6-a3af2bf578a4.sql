-- Top stores viewed
CREATE OR REPLACE FUNCTION public.pageviews_top_stores(_days integer, _limit integer DEFAULT 10)
RETURNS TABLE (store_id text, store_name text, views bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    split_part(pv.path, '/', 3) AS store_id,
    s.name AS store_name,
    COUNT(*)::bigint AS views
  FROM public.page_views pv
  LEFT JOIN public.stores s ON s.id = split_part(pv.path, '/', 3)
  WHERE pv.path LIKE '/magasins/%'
    AND pv.created_at >= now() - (_days || ' days')::interval
    AND is_admin(auth.uid())
  GROUP BY split_part(pv.path, '/', 3), s.name
  ORDER BY views DESC
  LIMIT _limit;
$$;

-- Top products viewed
CREATE OR REPLACE FUNCTION public.pageviews_top_products(_days integer, _limit integer DEFAULT 10)
RETURNS TABLE (product_id text, product_name text, views bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    split_part(pv.path, '/', 3) AS product_id,
    p.name AS product_name,
    COUNT(*)::bigint AS views
  FROM public.page_views pv
  LEFT JOIN public.products p
    ON p.id::text = split_part(pv.path, '/', 3)
  WHERE pv.path LIKE '/produit/%'
    AND pv.created_at >= now() - (_days || ' days')::interval
    AND is_admin(auth.uid())
  GROUP BY split_part(pv.path, '/', 3), p.name
  ORDER BY views DESC
  LIMIT _limit;
$$;

-- Aggregate stats: totals, unique visitors, device breakdown
CREATE OR REPLACE FUNCTION public.pageviews_stats(_days integer)
RETURNS TABLE (
  total_views bigint,
  unique_sessions bigint,
  mobile_views bigint,
  tablet_views bigint,
  desktop_views bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS total_views,
    COUNT(DISTINCT session_id)::bigint AS unique_sessions,
    COUNT(*) FILTER (
      WHERE user_agent ~* '(iphone|android(?!.*tablet)|mobile|ipod|blackberry|windows phone)'
        AND user_agent !~* 'ipad|tablet'
    )::bigint AS mobile_views,
    COUNT(*) FILTER (
      WHERE user_agent ~* '(ipad|tablet)'
    )::bigint AS tablet_views,
    COUNT(*) FILTER (
      WHERE user_agent !~* '(iphone|android|mobile|ipod|blackberry|windows phone|ipad|tablet)'
    )::bigint AS desktop_views
  FROM public.page_views
  WHERE created_at >= now() - (_days || ' days')::interval
    AND is_admin(auth.uid());
$$;