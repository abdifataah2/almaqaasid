-- Drop existing restrictive policies on classes
DROP POLICY IF EXISTS "Anyone can view classes" ON public.classes;
DROP POLICY IF EXISTS "Admins can manage classes" ON public.classes;

-- Create permissive SELECT policy for public access
CREATE POLICY "Anyone can view classes"
ON public.classes
FOR SELECT
TO public
USING (true);

-- Create admin management policy
CREATE POLICY "Admins can manage classes"
ON public.classes
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));