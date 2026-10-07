-- Create auth_logs table for security auditing
CREATE TABLE public.auth_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  registration_number TEXT,
  ip_address TEXT,
  user_agent TEXT,
  action TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  country TEXT,
  city TEXT
);

-- Enable RLS
ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view auth logs
CREATE POLICY "Only admins can view auth logs"
ON public.auth_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only service role can insert (edge function uses service role)
CREATE POLICY "Service role can insert auth logs"
ON public.auth_logs
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_auth_logs_registration_number ON public.auth_logs(registration_number);
CREATE INDEX idx_auth_logs_ip_address ON public.auth_logs(ip_address);
CREATE INDEX idx_auth_logs_created_at ON public.auth_logs(created_at DESC);
CREATE INDEX idx_auth_logs_success ON public.auth_logs(success);