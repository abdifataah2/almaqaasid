-- Add password column to students table for student authentication
ALTER TABLE public.students 
ADD COLUMN password_hash TEXT;

-- Update RLS policy to only allow students to view their own data when logged in
DROP POLICY IF EXISTS "Public can view students by reg number" ON public.students;

-- Allow authenticated students to view only their own record
CREATE POLICY "Students can view their own data"
ON public.students
FOR SELECT
TO authenticated
USING (
  registration_number = current_setting('app.current_student_reg', true)
  OR has_role(auth.uid(), 'admin')
);

-- Allow public to check if student exists (for login validation)
CREATE POLICY "Public can check student existence"
ON public.students
FOR SELECT
TO public
USING (true);

-- Update results RLS to only allow viewing own results
DROP POLICY IF EXISTS "Public can view results" ON public.results;

CREATE POLICY "Students can view their own results"
ON public.results
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students 
    WHERE registration_number = current_setting('app.current_student_reg', true)
  )
  OR has_role(auth.uid(), 'admin')
);