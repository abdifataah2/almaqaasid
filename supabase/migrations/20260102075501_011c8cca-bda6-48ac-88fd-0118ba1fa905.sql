-- =============================================
-- SECURITY FIX: Remove dangerous RLS policies
-- =============================================

-- 1. Remove policy that allows users to assign themselves any role (CRITICAL)
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;

-- 2. Remove public access to student data (exposes PII)
DROP POLICY IF EXISTS "Public can check student existence" ON public.students;

-- 3. Remove public access to results
DROP POLICY IF EXISTS "Anyone can view results" ON public.results;

-- =============================================
-- Create secure replacement policies
-- =============================================

-- Students table: Only allow minimal lookup for login verification via Edge Function
-- The Edge Function will use service role, so we only need admin access here
CREATE POLICY "Only admins can view full student data"
ON public.students
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Results table: Only admins can view results directly
-- Students will access via Edge Function with proper validation
CREATE POLICY "Only admins can view results"
ON public.results
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));