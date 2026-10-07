-- Restore Data API access to students for signed-in users, excluding password_hash from reads
GRANT SELECT (id, full_name, registration_number, class_id, created_at) ON public.students TO authenticated;
GRANT INSERT (id, full_name, registration_number, class_id, created_at) ON public.students TO authenticated;
GRANT UPDATE (full_name, registration_number, class_id) ON public.students TO authenticated;
GRANT DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;