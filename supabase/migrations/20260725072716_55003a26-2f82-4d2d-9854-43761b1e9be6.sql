
GRANT SELECT (id, full_name, registration_number, class_id, created_at) ON public.students TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
