
-- 1) Hide password_hash column from non-admin authenticated users using column-level grants.
REVOKE SELECT ON public.students FROM authenticated;
GRANT SELECT (id, full_name, registration_number, class_id, created_at) ON public.students TO authenticated;
-- service_role keeps full access; admin RLS policy uses service_definer has_role and admin panel uses service role via edge/admin flow.
GRANT SELECT ON public.students TO service_role;

-- 2) Secure students_public view: use security_invoker so RLS applies, and restrict to authenticated only.
ALTER VIEW public.students_public SET (security_invoker = on);
REVOKE ALL ON public.students_public FROM PUBLIC, anon;
GRANT SELECT ON public.students_public TO authenticated;
GRANT ALL ON public.students_public TO service_role;
