import { useEffect, useState, forwardRef } from 'react';
import { Users, UserCheck, Layers, BookOpen, ClipboardList, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  students: number;
  teachers: number;
  classes: number;
  subjects: number;
  results: number;
}

const Dashboard = forwardRef<HTMLDivElement>((_, ref) => {
  const [stats, setStats] = useState<Stats>({
    students: 0,
    teachers: 0,
    classes: 0,
    subjects: 0,
    results: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [students, teachers, classes, subjects, results] = await Promise.all([
          supabase.from('students').select('id', { count: 'exact', head: true }),
          supabase.from('teachers').select('id', { count: 'exact', head: true }),
          supabase.from('classes').select('id', { count: 'exact', head: true }),
          supabase.from('subjects').select('id', { count: 'exact', head: true }),
          supabase.from('results').select('id', { count: 'exact', head: true }),
        ]);

        setStats({
          students: students.count || 0,
          teachers: teachers.count || 0,
          classes: classes.count || 0,
          subjects: subjects.count || 0,
          results: results.count || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Students', value: stats.students, icon: Users, color: 'bg-primary/10 text-primary' },
    { label: 'Total Teachers', value: stats.teachers, icon: UserCheck, color: 'bg-secondary/10 text-secondary' },
    { label: 'Classes', value: stats.classes, icon: Layers, color: 'bg-accent/20 text-accent-foreground' },
    { label: 'Subjects', value: stats.subjects, icon: BookOpen, color: 'bg-info/10 text-info' },
    { label: 'Results Recorded', value: stats.results, icon: ClipboardList, color: 'bg-success/10 text-success' },
  ];

  return (
    <AdminLayout ref={ref} title="Dashboard" description="Overview of Al-Maqaasid School">
      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.label} 
              className="shadow-md hover:shadow-lg transition-shadow animate-slide-up border-white/10"
              style={{ background: 'hsl(230, 30%, 16%)', animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/60">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                      {loading ? '-' : stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card className="shadow-md animate-slide-up border-white/10" style={{ background: 'hsl(230, 30%, 16%)', animationDelay: '0.5s' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5 text-primary" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <a 
              href="/admin/students" 
              className="p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors group"
            >
              <Users className="h-8 w-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-white">Manage Students</h3>
              <p className="text-sm text-white/50">Add, edit, or import students</p>
            </a>
            <a 
              href="/admin/results" 
              className="p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors group"
            >
              <ClipboardList className="h-8 w-8 text-secondary mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-white">Enter Results</h3>
              <p className="text-sm text-white/50">Record student marks</p>
            </a>
            <a 
              href="/admin/classes" 
              className="p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors group"
            >
              <Layers className="h-8 w-8 text-accent mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-white">Manage Classes</h3>
              <p className="text-sm text-white/50">Add or edit class levels</p>
            </a>
            <a 
              href="/admin/subjects" 
              className="p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors group"
            >
              <BookOpen className="h-8 w-8 text-info mb-2 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-white">Manage Subjects</h3>
              <p className="text-sm text-white/50">Add or edit subjects</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
});

Dashboard.displayName = 'Dashboard';

export default Dashboard;
