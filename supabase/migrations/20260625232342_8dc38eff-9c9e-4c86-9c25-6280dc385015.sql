
REVOKE ALL ON FUNCTION public.consume_reveal(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_reveal(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.consume_reveal(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_reveal(uuid, uuid, text) TO service_role;
