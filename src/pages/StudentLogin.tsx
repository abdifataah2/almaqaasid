import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogIn, User, Lock } from 'lucide-react';
import schoolLogo from '@/assets/school-logo-new.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const StudentLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [regNumber, setRegNumber] = useState('');
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if student is already logged in with valid token
  useEffect(() => {
    const token = sessionStorage.getItem('student_token');
    if (token) {
      // Verify token is still valid
      verifyToken(token);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('student-auth', {
        body: { token },
        headers: { 'Content-Type': 'application/json' },
      });

      // Handle query params for action
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-auth?action=verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }
      );

      const result = await response.json();

      if (result.valid) {
        navigate('/results');
      } else {
        // Token invalid, clear it
        sessionStorage.removeItem('student_token');
        sessionStorage.removeItem('student_data');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      sessionStorage.removeItem('student_token');
      sessionStorage.removeItem('student_data');
    }
  };

  const handleLogin = async () => {
    if (!regNumber.trim()) {
      toast({
        title: "Registration Number Required",
        description: "Please enter your registration number.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-auth?action=login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            registration_number: regNumber.trim(),
            password: password || undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.requires_password) {
          setRequiresPassword(true);
          toast({
            title: "Password Required",
            description: "Please enter your password to continue.",
            variant: "default",
          });
          return;
        }
        
        // Show specific error for registration number not found
        if (response.status === 404) {
          toast({
            title: "Registration Number Not Found",
            description: "This registration number is not registered in our system. Please contact your school admin.",
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Login Failed",
          description: result.error || "Invalid credentials. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Store secure token and student data
      sessionStorage.setItem('student_token', result.token);
      sessionStorage.setItem('student_data', JSON.stringify(result.student));

      toast({
        title: "Login Successful",
        description: `Welcome, ${result.student.full_name}!`,
      });

      navigate('/results');
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: "Error",
        description: "An error occurred during login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, hsl(230, 35%, 12%) 0%, hsl(240, 30%, 16%) 50%, hsl(220, 35%, 14%) 100%)' }}>
      {/* Header */}
      <header className="py-4 px-6 border-b border-white/10">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={schoolLogo} alt="School Logo" className="h-12 w-12 rounded-full object-contain" />
            <div>
              <h1 className="text-xl font-bold text-white">Al-Maqaasid School</h1>
              <p className="text-sm text-white/60">Student Portal</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </header>

      {/* Login Form */}
      <main className="flex-1 container mx-auto px-6 py-12 flex items-center justify-center">
        <Card className="w-full max-w-md shadow-2xl animate-scale-in border border-white/10" style={{ background: 'hsl(230, 30%, 14%)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, hsl(270, 70%, 55%), hsl(190, 90%, 50%))' }} />
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-3 rounded-full w-fit mb-4" style={{ background: 'linear-gradient(135deg, hsl(260, 60%, 50%), hsl(220, 70%, 45%))' }}>
              <LogIn className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-white">Student Login</CardTitle>
            <CardDescription className="text-white/50">
              Enter your registration number to view your results
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="space-y-2">
              <label htmlFor="regNumber" className="text-sm font-medium text-white/80 flex items-center gap-2">
                <User className="h-4 w-4" />
                Registration Number
              </label>
              <Input
                id="regNumber"
                type="text"
                placeholder="e.g., STU/2024/001"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !requiresPassword && handleLogin()}
                className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50"
                disabled={isLoading}
              />
            </div>
            
            {requiresPassword && (
              <div className="space-y-2 animate-slide-up">
                <label htmlFor="password" className="text-sm font-medium text-white/80 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            )}
            
            <Button 
              onClick={handleLogin} 
              className="w-full h-12 text-lg font-semibold text-white"
              style={{ background: 'linear-gradient(90deg, hsl(270, 70%, 50%), hsl(190, 90%, 50%))' }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  View My Results
                </>
              )}
            </Button>
            <p className="text-center text-sm text-white/40">
              Can't find your registration number?{' '}
              <span className="text-purple-400 font-medium">Contact your school admin</span>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default StudentLogin;
