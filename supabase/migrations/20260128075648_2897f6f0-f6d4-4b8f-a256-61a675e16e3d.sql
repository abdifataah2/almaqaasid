
-- Drop the old students_public view and recreate with security_invoker
DROP VIEW IF EXISTS public.students_public;

-- Recreate view with security_invoker=on (inherits RLS from base table)
CREATE VIEW public.students_public
WITH (security_invoker=on) AS
  SELECT id,
    registration_number,
    full_name,
    class_id,
    created_at
  FROM public.students;

-- Add comment explaining the view
COMMENT ON VIEW public.students_public IS 'Public view of students table excluding password_hash. Uses security_invoker to inherit RLS from base table.';
