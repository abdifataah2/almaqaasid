import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function safeNext(raw: string | null): string {
  if (!raw) return '/admin';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/admin';
  return raw;
}
import { Shield, Mail, Lock, ArrowLeft } from 'lucide-react';
import schoolLogo from '@/assets/school-logo-new.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }),
  password: z.string().min(5, { message: "Password must be at least 5 characters" }),
});

const AdminLogin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const { signIn, user, isAdmin, isTeacher, loading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate(next);
    } else if (!loading && user && isTeacher) {
      navigate('/admin/results');
    }
  }, [user, isAdmin, isTeacher, loading, navigate, next]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmed = email.trim().toLowerCase().replace(/\s+/g, '');
    const loginEmail = trimmed.includes('@') ? trimmed : `${trimmed}@am.com`;
    const validation = loginSchema.safeParse({ email: loginEmail, password });
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(loginEmail, password);

      if (error) {
        let message = "Invalid credentials. Please try again.";
        if (error.message.includes('Invalid login credentials')) {
          message = "Invalid email or password.";
        } else if (error.message.includes('Email not confirmed')) {
          message = "Please confirm your email before logging in.";
        }
        toast({
          title: "Login Failed",
          description: message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Login Successful",
        description: "Checking admin access...",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(230, 35%, 12%) 0%, hsl(240, 30%, 16%) 50%, hsl(220, 35%, 14%) 100%)' }}>
        <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, hsl(230, 35%, 12%) 0%, hsl(240, 30%, 16%) 50%, hsl(220, 35%, 14%) 100%)' }}>
      {/* Header */}
      <header className="gradient-hero text-primary-foreground py-4 px-6">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={schoolLogo} alt="School Logo" className="h-12 w-12 rounded-full object-contain" />
            <div>
              <h1 className="text-xl font-bold">Al-Maqaasid School</h1>
              <p className="text-sm opacity-90">Admin Portal</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </header>

      {/* Login Form */}
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-xl border-2 animate-scale-in">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto p-4 bg-primary/10 rounded-2xl w-fit">
              <Shield className="h-10 w-10 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Admin Login</CardTitle>
              <CardDescription className="mt-2">
                Sign in to access the administration dashboard
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="text"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12"
                    autoComplete="off"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 text-lg mt-6"
                variant="hero"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Shield className="h-5 w-5" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminLogin;
