DROP POLICY IF EXISTS "Service role can insert auth logs" ON public.auth_logs;
CREATE POLICY "Only service role can insert auth logs" ON public.auth_logs FOR INSERT TO service_role WITH CHECK (true);
REVOKE INSERT ON public.auth_logs FROM anon, authenticated;
GRANT ALL ON public.auth_logs TO service_role;