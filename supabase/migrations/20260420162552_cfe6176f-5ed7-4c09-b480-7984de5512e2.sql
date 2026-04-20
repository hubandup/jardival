-- Page view tracking table
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  referrer text,
  user_agent text,
  session_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX idx_page_views_path ON public.page_views (path);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can insert a pageview
CREATE POLICY "Anyone can insert pageviews"
  ON public.page_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read analytics
CREATE POLICY "Admins read pageviews"
  ON public.page_views
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Aggregation function: daily pageviews over N days
CREATE OR REPLACE FUNCTION public.pageviews_daily(_days integer)
RETURNS TABLE (day date, views bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d::date AS day,
    COALESCE(COUNT(pv.id), 0) AS views
  FROM generate_series(
    (current_date - (_days - 1) * interval '1 day')::date,
    current_date,
    interval '1 day'
  ) AS d
  LEFT JOIN public.page_views pv
    ON pv.created_at::date = d::date
  WHERE is_admin(auth.uid())
  GROUP BY d
  ORDER BY d;
$$;

-- Top paths over N days
CREATE OR REPLACE FUNCTION public.pageviews_top_paths(_days integer, _limit integer DEFAULT 10)
RETURNS TABLE (path text, views bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT path, COUNT(*)::bigint AS views
  FROM public.page_views
  WHERE created_at >= now() - (_days || ' days')::interval
    AND is_admin(auth.uid())
  GROUP BY path
  ORDER BY views DESC
  LIMIT _limit;
$$;