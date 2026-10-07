-- Create a view that hides password_hash from students table
CREATE VIEW public.students_public
WITH (security_invoker=on) AS
  SELECT id, registration_number, full_name, class_id, created_at
  FROM public.students;

-- Add server-side validation constraints
ALTER TABLE public.students 
ADD CONSTRAINT students_full_name_length 
CHECK (length(full_name) >= 1 AND length(full_name) <= 200);

ALTER TABLE public.students 
ADD CONSTRAINT students_registration_number_length 
CHECK (length(registration_number) >= 1 AND length(registration_number) <= 50);

ALTER TABLE public.results 
ADD CONSTRAINT results_marks_range 
CHECK (marks >= 0 AND marks <= 100);

ALTER TABLE public.teachers 
ADD CONSTRAINT teachers_name_length 
CHECK (length(name) >= 1 AND length(name) <= 200);

ALTER TABLE public.classes 
ADD CONSTRAINT classes_name_length 
CHECK (length(name) >= 1 AND length(name) <= 100);

ALTER TABLE public.subjects 
ADD CONSTRAINT subjects_name_length 
CHECK (length(name) >= 1 AND length(name) <= 100);