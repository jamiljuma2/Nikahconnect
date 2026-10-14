-- Return each member's primary profile image in the admin member search.
-- Dropping is required because PostgreSQL cannot change a function's return type
-- with CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.admin_search_members(text, integer, integer);

CREATE FUNCTION public.admin_search_members(
  search_term text,
  page_size integer,
  page_offset integer
)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  location text,
  suspended boolean,
  deactivated_at timestamptz,
  created_at timestamptz,
  email text,
  is_admin boolean,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH filtered AS (
    SELECT
      p.id,
      p.full_name,
      p.avatar_url,
      p.location,
      p.suspended,
      p.deactivated_at,
      p.created_at,
      COALESCE(c.email, '') AS email,
      EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = p.id AND r.role = 'admin'
      ) AS is_admin
    FROM public.profiles p
    LEFT JOIN public.user_contacts c ON c.user_id = p.id
    WHERE search_term = ''
      OR p.full_name ILIKE '%' || search_term || '%'
      OR p.location ILIKE '%' || search_term || '%'
      OR c.email ILIKE '%' || search_term || '%'
  )
  SELECT
    f.id,
    f.full_name,
    f.avatar_url,
    f.location,
    f.suspended,
    f.deactivated_at,
    f.created_at,
    f.email,
    f.is_admin,
    COUNT(*) OVER () AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC, f.id
  LIMIT LEAST(GREATEST(page_size, 1), 50)
  OFFSET GREATEST(page_offset, 0);
$$;

REVOKE ALL ON FUNCTION public.admin_search_members(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_members(text, integer, integer) TO service_role;
