REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM authenticated, anon;