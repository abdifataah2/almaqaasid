import { useLocation, useNavigate } from 'react-router-dom';
import { 
  GraduationCap, 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  BookOpen, 
  Layers, 
  ClipboardList,
  CalendarCheck,
  DollarSign,
  LogOut,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import schoolLogo from '@/assets/school-logo-new.png';


const menuItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/students', label: 'Students', icon: Users },
  { path: '/admin/teachers', label: 'Teachers', icon: UserCheck },
  { path: '/admin/classes', label: 'Classes', icon: Layers },
  { path: '/admin/subjects', label: 'Subjects', icon: BookOpen },
  { path: '/admin/results', label: 'Results', icon: ClipboardList },
  { path: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { path: '/admin/finance', label: 'Finance', icon: DollarSign },
];

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

const AdminSidebar = ({ mobileOpen = false, onClose }: AdminSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  const visibleItems = isAdmin ? menuItems : menuItems.filter((i) => i.path === '/admin/results');

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose?.();
  };

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-50 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-300 lg:translate-x-0",
      mobileOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3 pr-8 lg:pr-0">
          <img src={schoolLogo} alt="Al-Maqaasid School logo" className="h-12 w-12 rounded-full object-contain shrink-0" />
          <div>
            <h1 className="font-bold text-lg">Al-Maqaasid</h1>
            <p className="text-xs text-sidebar-foreground/60">School Admin</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close navigation"
          className="absolute right-3 top-5 text-sidebar-foreground lg:hidden"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>


      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Button
              key={item.path}
              variant="ghost"
              onClick={() => handleNavigate(item.path)}
              className={cn(
                "h-auto w-full justify-start gap-3 px-4 py-3 text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" 
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5 mr-3" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
