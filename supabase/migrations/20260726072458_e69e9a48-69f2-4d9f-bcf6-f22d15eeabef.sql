DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['attendance','auth_logs','class_subjects','classes','finance','results','subjects','teachers','user_roles']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

GRANT ALL ON public.students TO service_role;