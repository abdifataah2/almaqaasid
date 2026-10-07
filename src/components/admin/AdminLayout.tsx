import { ReactNode, useEffect, forwardRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

const AdminLayout = forwardRef<HTMLDivElement, AdminLayoutProps>(({ children, title, description }, ref) => {
  const { user, isAdmin, isTeacher, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const teacherAllowed = isTeacher && location.pathname === '/admin/results';

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/admin/login');
      } else if (!isAdmin && isTeacher && !teacherAllowed) {
        navigate('/admin/results');
      } else if (!isAdmin && !isTeacher) {
        navigate('/');
      }
    }
  }, [user, isAdmin, isTeacher, teacherAllowed, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(230, 35%, 12%) 0%, hsl(240, 30%, 16%) 50%, hsl(220, 35%, 14%) 100%)' }}>
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (!isAdmin && !teacherAllowed)) {
    return null;
  }

  return (
    <div ref={ref} className="min-h-screen" style={{ background: 'linear-gradient(135deg, hsl(230, 35%, 12%) 0%, hsl(240, 30%, 16%) 50%, hsl(220, 35%, 14%) 100%)' }}>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <AdminSidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <main className="min-h-screen min-w-0 lg:ml-64">
        {/* Header */}
        <header className="border-b border-white/10 px-4 py-4 sm:px-6 lg:px-8 lg:py-6" style={{ background: 'hsla(230, 30%, 14%, 0.8)' }}>
          <div className="flex min-w-0 items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              className="mt-0.5 shrink-0 text-white hover:bg-white/10 hover:text-white lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white sm:text-2xl">{title}</h1>
              {description && (
                <p className="mt-1 text-sm text-white/60 sm:text-base">{description}</p>
              )}
            </div>
          </div>
        </header>
        
        {/* Content */}
        <div className="min-w-0 p-3 sm:p-5 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
});

AdminLayout.displayName = 'AdminLayout';

export default AdminLayout;
