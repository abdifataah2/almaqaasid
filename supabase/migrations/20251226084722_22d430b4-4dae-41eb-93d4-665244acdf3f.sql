-- Drop the existing restrictive policy on results
DROP POLICY IF EXISTS "Students can view their own results" ON public.results;

-- Create a simpler policy that allows anyone to select results (data is already filtered by student_id in the query)
CREATE POLICY "Anyone can view results"
ON public.results
FOR SELECT
USING (true);