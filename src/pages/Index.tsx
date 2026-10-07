import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, LogIn, User, Lock, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import schoolLogo from '@/assets/school-logo-new.png';

const Index = () => {
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
      verifyToken(token);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
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
        
        toast({
          title: "Login Failed",
          description: result.error || "Invalid credentials. Please try again.",
          variant: "destructive",
        });
        return;
      }

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
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={schoolLogo} alt="Al-Maqaasid School Logo" className="h-12 w-12 rounded-full object-contain shrink-0" />
            <div className="leading-tight">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-wide" style={{ color: 'hsl(45, 100%, 60%)' }}>Al-Maqaasid</h1>
              <p className="text-xs sm:text-sm font-medium" style={{ color: 'hsl(190, 90%, 55%)' }}>Primary and Secondary School</p>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="border-white/20 text-white bg-white/5 hover:bg-white/10 hover:text-white"
            onClick={() => navigate('/admin/login')}
          >
            <Shield className="h-4 w-4 mr-2" />
            Admin Portal
          </Button>
        </div>
      </header>

      {/* Main Content - Centered Student Portal */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-6 py-12 max-w-md">
          <div className="animate-scale-in">
            <Card className="shadow-2xl border border-white/10 overflow-hidden" style={{ background: 'hsl(230, 30%, 14%)' }}>
              {/* Gradient top border */}
              <div className="h-1" style={{ background: 'linear-gradient(90deg, hsl(270, 70%, 55%), hsl(190, 90%, 50%))' }} />
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, hsl(260, 60%, 50%), hsl(220, 70%, 45%))' }}>
                    <LogIn className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-white">Student Login</CardTitle>
                </div>
                <CardDescription className="text-white/50">
                  Enter your registration number to continue
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 pb-6 space-y-4">
                {/* Registration Number Input */}
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
                    className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50"
                    disabled={isLoading}
                  />
                </div>

                {/* Password Input - Only shown when required */}
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
                      className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50"
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                )}

                {/* Login Button */}
                <Button 
                  onClick={handleLogin} 
                  className="w-full h-11 text-base font-semibold text-white shadow-lg"
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
                      Sign In
                    </>
                  )}
                </Button>

                <p className="text-center text-sm text-white/40 pt-2">
                  Need help?{' '}
                  <span className="text-purple-400 font-medium cursor-pointer hover:underline">
                    Contact admin
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white/30">
              <GraduationCap className="h-5 w-5" />
              <span className="text-sm">Al-Maqaasid School © 2024</span>
            </div>
            <p className="text-sm text-white/30">
              Empowering Education Through Technology
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
