import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import schoolLogo from '@/assets/school-logo-new.png';

// Beta namespace typing for supabase.auth.oauth
interface OAuthAuthorizationDetails {
  client?: { name?: string; client_uri?: string };
  redirect_uri?: string;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
}
interface OAuthResult {
  redirect_url?: string;
  redirect_to?: string;
}
type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthAuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
};

const OAuthConsent = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const authorizationId = params.get('authorization_id') ?? '';

  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const oauth = (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

  useEffect(() => {
    if (authLoading) return;
    if (!authorizationId) {
      setError('Missing authorization_id');
      setLoading(false);
      return;
    }
    if (!user) {
      const next = window.location.pathname + window.location.search;
      navigate(`/admin/login?next=${encodeURIComponent(next)}`, { replace: true });
      return;
    }

    let active = true;
    (async () => {
      try {
        const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
        setLoading(false);
      } catch (e) {
        if (!active) return;
        setError((e as Error).message);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, user, authLoading, navigate, oauth]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        setError(error.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError('No redirect returned by the authorization server.');
        return;
      }
      window.location.href = target;
    } catch (e) {
      setBusy(false);
      setError((e as Error).message);
    }
  }

  const bg = { background: 'linear-gradient(135deg, hsl(230, 35%, 12%) 0%, hsl(240, 30%, 16%) 50%, hsl(220, 35%, 14%) 100%)' };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bg}>
        <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={bg}>
        <Card className="w-full max-w-md border-white/10" style={{ background: 'hsl(230, 30%, 14%)' }}>
          <CardHeader>
            <div className="mx-auto p-3 rounded-full bg-destructive/10 w-fit">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-center text-white mt-2">Authorization Error</CardTitle>
            <CardDescription className="text-center text-white/60">{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate('/admin')}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clientName = details?.client?.name ?? 'an external app';

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={bg}>
      <Card className="w-full max-w-lg border-white/10 shadow-2xl" style={{ background: 'hsl(230, 30%, 14%)' }}>
        <CardHeader className="text-center space-y-3">
          <img src={schoolLogo} alt="Al-Maqaasid" className="mx-auto h-16 w-16 rounded-full object-contain" />
          <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-white">
            Connect {clientName} to Al-Maqaasid
          </CardTitle>
          <CardDescription className="text-white/60">
            Signed in as <span className="text-white/90 font-medium">{user?.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-2 text-sm text-white/80">
            <p><strong>{clientName}</strong> will be able to call this app's MCP tools while you are signed in.</p>
            <ul className="list-disc list-inside space-y-1 text-white/70">
              <li>Read student, class, results, attendance, and fee data</li>
              <li>Act with your identity — all row-level policies still apply</li>
            </ul>
            {!isAdmin && (
              <p className="text-yellow-400 mt-2">
                Note: Your account is not an admin. The MCP tools will refuse access.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => decide(false)}
            >
              Cancel connection
            </Button>
            <Button
              className="flex-1"
              disabled={busy}
              onClick={() => decide(true)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </div>
          <p className="text-xs text-center text-white/40">
            This does not bypass this app's permissions or backend policies.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OAuthConsent;
