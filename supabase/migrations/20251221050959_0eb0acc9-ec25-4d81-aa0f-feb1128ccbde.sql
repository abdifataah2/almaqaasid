-- Create junction table for class-subject relationships
CREATE TABLE public.class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(class_id, subject_id)
);

-- Enable RLS
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage class_subjects"
ON public.class_subjects
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view class_subjects"
ON public.class_subjects
FOR SELECT
USING (true);