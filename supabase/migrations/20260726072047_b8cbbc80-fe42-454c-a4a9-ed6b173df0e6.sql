-- 1. Classes / subjects / class_subjects: authenticated only
DROP POLICY IF EXISTS "Anyone can view classes" ON public.classes;
CREATE POLICY "Authenticated users can view classes"
ON public.classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view subjects" ON public.subjects;
CREATE POLICY "Authenticated users can view subjects"
ON public.subjects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view class_subjects" ON public.class_subjects;
CREATE POLICY "Authenticated users can view class_subjects"
ON public.class_subjects FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.classes FROM anon;
REVOKE SELECT ON public.subjects FROM anon;
REVOKE SELECT ON public.class_subjects FROM anon;

-- 2. Teachers: admin only
DROP POLICY IF EXISTS "Anyone can view teachers" ON public.teachers;
CREATE POLICY "Admins can view teachers"
ON public.teachers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
REVOKE SELECT ON public.teachers FROM anon;

-- 3. Students: remove spoofable current_setting-based policy
DROP POLICY IF EXISTS "Students can view their own data" ON public.students;
REVOKE ALL ON public.students FROM anon;

-- 4. has_role: not callable by anonymous visitors
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;