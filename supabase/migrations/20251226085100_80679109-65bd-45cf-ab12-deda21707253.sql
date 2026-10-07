-- Drop existing restrictive policies on subjects
DROP POLICY IF EXISTS "Anyone can view subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;

-- Create permissive SELECT policy for public access
CREATE POLICY "Anyone can view subjects"
ON public.subjects
FOR SELECT
TO public
USING (true);

-- Create admin management policy
CREATE POLICY "Admins can manage subjects"
ON public.subjects
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));