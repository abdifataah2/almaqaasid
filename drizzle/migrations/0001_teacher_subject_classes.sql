ALTER TABLE public.teacher_subjects ADD COLUMN class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE public.teacher_subjects DROP CONSTRAINT teacher_subjects_teacher_id_subject_id_key;

INSERT INTO public.teacher_subjects (teacher_id, subject_id, class_id)
SELECT ts.teacher_id, ts.subject_id, cs.class_id
FROM public.teacher_subjects ts JOIN public.class_subjects cs ON cs.subject_id = ts.subject_id
WHERE ts.class_id IS NULL;
DELETE FROM public.teacher_subjects WHERE class_id IS NULL;

ALTER TABLE public.teacher_subjects ADD CONSTRAINT teacher_subjects_unique UNIQUE (teacher_id, subject_id, class_id);

CREATE OR REPLACE FUNCTION public.teacher_teaches_subject_class(_user_id uuid, _subject_id uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teachers t JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
    WHERE t.user_id = _user_id AND ts.subject_id = _subject_id AND ts.class_id = _class_id)
$$;
CREATE OR REPLACE FUNCTION public.teacher_teaches_class(_user_id uuid, _class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teachers t JOIN public.teacher_subjects ts ON ts.teacher_id = t.id
    WHERE t.user_id = _user_id AND ts.class_id = _class_id)
$$;
REVOKE EXECUTE ON FUNCTION public.teacher_teaches_subject_class(uuid,uuid,uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.teacher_teaches_class(uuid,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.teacher_teaches_subject_class(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_teaches_class(uuid,uuid) TO authenticated;

DROP POLICY "Teachers view own subject results" ON public.results;
DROP POLICY "Teachers insert own subject results" ON public.results;
DROP POLICY "Teachers update own subject results" ON public.results;
DROP POLICY "Teachers delete own subject results" ON public.results;
CREATE POLICY "Teachers view own subject results" ON public.results FOR SELECT TO authenticated USING (public.teacher_teaches_subject_class(auth.uid(), subject_id, class_id));
CREATE POLICY "Teachers insert own subject results" ON public.results FOR INSERT TO authenticated WITH CHECK (public.teacher_teaches_subject_class(auth.uid(), subject_id, class_id));
CREATE POLICY "Teachers update own subject results" ON public.results FOR UPDATE TO authenticated USING (public.teacher_teaches_subject_class(auth.uid(), subject_id, class_id)) WITH CHECK (public.teacher_teaches_subject_class(auth.uid(), subject_id, class_id));
CREATE POLICY "Teachers delete own subject results" ON public.results FOR DELETE TO authenticated USING (public.teacher_teaches_subject_class(auth.uid(), subject_id, class_id));

DROP POLICY "Teachers view students" ON public.students;
CREATE POLICY "Teachers view students" ON public.students FOR SELECT TO authenticated USING (public.teacher_teaches_class(auth.uid(), class_id));