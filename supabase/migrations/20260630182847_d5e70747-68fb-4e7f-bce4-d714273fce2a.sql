
-- Revoke public/anon/authenticated EXECUTE on SECURITY DEFINER functions
-- Trigger-only functions: revoke from all client roles
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.products_set_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stores_set_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promotions_set_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.media_assets_set_title_from_entity() FROM PUBLIC, anon, authenticated;

-- Email queue helpers: backend-only (service_role)
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- Role/membership predicates: used inside RLS policies; restrict direct API exposure to authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;

-- Analytics RPCs: admin-only consumers; keep authenticated (internal admin checks already enforced inside the SQL via is_admin)
REVOKE EXECUTE ON FUNCTION public.pageviews_daily(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pageviews_stats(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pageviews_top_paths(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pageviews_top_products(integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pageviews_top_stores(integer, integer) FROM PUBLIC, anon;

-- slugify is IMMUTABLE helper, restrict
REVOKE EXECUTE ON FUNCTION public.slugify(text) FROM PUBLIC, anon, authenticated;
