
CREATE OR REPLACE FUNCTION public.pageviews_daily(_days integer)
 RETURNS TABLE(day date, views bigint)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT d::date AS day, COALESCE(COUNT(pv.id), 0) AS views
  FROM generate_series((current_date - (_days - 1) * interval '1 day')::date, current_date, interval '1 day') AS d
  LEFT JOIN public.page_views pv ON pv.created_at::date = d::date
  WHERE public.is_admin(auth.uid())
  GROUP BY d ORDER BY d;
$function$;

CREATE OR REPLACE FUNCTION public.pageviews_stats(_days integer)
 RETURNS TABLE(total_views bigint, unique_sessions bigint, mobile_views bigint, tablet_views bigint, desktop_views bigint)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::bigint, COUNT(DISTINCT session_id)::bigint,
    COUNT(*) FILTER (WHERE user_agent ~* '(iphone|android(?!.*tablet)|mobile|ipod|blackberry|windows phone)' AND user_agent !~* 'ipad|tablet')::bigint,
    COUNT(*) FILTER (WHERE user_agent ~* '(ipad|tablet)')::bigint,
    COUNT(*) FILTER (WHERE user_agent !~* '(iphone|android|mobile|ipod|blackberry|windows phone|ipad|tablet)')::bigint
  FROM public.page_views
  WHERE created_at >= now() - (_days || ' days')::interval AND public.is_admin(auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.pageviews_top_paths(_days integer, _limit integer DEFAULT 10)
 RETURNS TABLE(path text, views bigint)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
  SELECT path, COUNT(*)::bigint FROM public.page_views
  WHERE created_at >= now() - (_days || ' days')::interval AND public.is_admin(auth.uid())
  GROUP BY path ORDER BY 2 DESC LIMIT _limit;
$function$;

CREATE OR REPLACE FUNCTION public.pageviews_top_products(_days integer, _limit integer DEFAULT 10)
 RETURNS TABLE(product_id text, product_name text, views bigint)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
  SELECT split_part(pv.path, '/', 3), p.name, COUNT(*)::bigint
  FROM public.page_views pv LEFT JOIN public.products p ON p.id::text = split_part(pv.path, '/', 3)
  WHERE pv.path LIKE '/produit/%' AND pv.created_at >= now() - (_days || ' days')::interval AND public.is_admin(auth.uid())
  GROUP BY 1, 2 ORDER BY 3 DESC LIMIT _limit;
$function$;

CREATE OR REPLACE FUNCTION public.pageviews_top_stores(_days integer, _limit integer DEFAULT 10)
 RETURNS TABLE(store_id text, store_name text, views bigint)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $function$
  SELECT split_part(pv.path, '/', 3), s.name, COUNT(*)::bigint
  FROM public.page_views pv LEFT JOIN public.stores s ON s.id = split_part(pv.path, '/', 3)
  WHERE pv.path LIKE '/magasins/%' AND pv.created_at >= now() - (_days || ' days')::interval AND public.is_admin(auth.uid())
  GROUP BY 1, 2 ORDER BY 3 DESC LIMIT _limit;
$function$;
