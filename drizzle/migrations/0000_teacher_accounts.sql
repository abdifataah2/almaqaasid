ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.is_teacher(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teachers WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.teacher_teaches_subject(_user_id uuid, _subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
    WHERE t.user_id = _user_id AND ts.subject_id = _subject_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_teacher(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.teacher_teaches_subject(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_teacher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_teaches_subject(uuid, uuid) TO authenticated;

CREATE POLICY "Teachers view own record" ON public.teachers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Teachers view students" ON public.students FOR SELECT TO authenticated USING (public.is_teacher(auth.uid()));
CREATE POLICY "Teachers view own subject results" ON public.results FOR SELECT TO authenticated USING (public.teacher_teaches_subject(auth.uid(), subject_id));
CREATE POLICY "Teachers insert own subject results" ON public.results FOR INSERT TO authenticated WITH CHECK (public.teacher_teaches_subject(auth.uid(), subject_id));
CREATE POLICY "Teachers update own subject results" ON public.results FOR UPDATE TO authenticated USING (public.teacher_teaches_subject(auth.uid(), subject_id)) WITH CHECK (public.teacher_teaches_subject(auth.uid(), subject_id));
CREATE POLICY "Teachers delete own subject results" ON public.results FOR DELETE TO authenticated USING (public.teacher_teaches_subject(auth.uid(), subject_id));