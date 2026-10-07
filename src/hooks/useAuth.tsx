import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isTeacher: boolean;
  teacherSubjectIds: string[];
  teacherAssignments: { subject_id: string; class_id: string | null }[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, assignAdminRole?: boolean) => Promise<{ error: Error | null; user?: User | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [teacherSubjectIds, setTeacherSubjectIds] = useState<string[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<{ subject_id: string; class_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error('Error checking admin role:', error);
      return false;
    }
  };

  const loadRoles = async (userId: string) => {
    const admin = await checkAdminRole(userId);
    let subjectIds: string[] = [];
    let assignments: { subject_id: string; class_id: string | null }[] = [];
    let teacher = false;
    const { data: t } = await supabase.from('teachers').select('id').eq('user_id', userId).maybeSingle();
    if (t) {
      teacher = true;
      const { data: ts } = await supabase.from('teacher_subjects').select('subject_id, class_id').eq('teacher_id', t.id);
      assignments = (ts || []) as any;
      subjectIds = [...new Set((ts || []).map((r) => r.subject_id))];
    }
    setIsAdmin(admin);
    setIsTeacher(teacher);
    setTeacherSubjectIds(subjectIds);
    setTeacherAssignments(assignments);
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => { loadRoles(session.user.id); }, 0);
        } else {
          setIsAdmin(false);
          setIsTeacher(false);
          setTeacherSubjectIds([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadRoles(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, assignAdminRole: boolean = false) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    
    // If signup successful and we need to assign admin role
    if (!error && data.user && assignAdminRole) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: data.user.id, role: 'admin' });
      
      if (roleError) {
        console.error('Error assigning admin role:', roleError);
      } else {
        setIsAdmin(true);
      }
    }
    
    return { error: error as Error | null, user: data?.user };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setIsTeacher(false);
    setTeacherSubjectIds([]);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isTeacher, teacherSubjectIds, teacherAssignments, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
