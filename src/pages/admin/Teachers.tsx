import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, UserCheck, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Teacher {
  id: string;
  name: string;
  subjects: { id: string; name: string; classes: string[] }[];
  links: { subject_id: string; class_id: string }[];
}

interface Subject {
  id: string;
  name: string;
}

const Teachers = () => {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [selected, setSelected] = useState<string[]>([]); // keys 'subjectId|classId'
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classSubjects, setClassSubjects] = useState<{ class_id: string; subject_id: string }[]>([]);

  const fetchData = async () => {
    try {
      const [teachersRes, subjectsRes, linksRes, classesRes, csRes] = await Promise.all([
        supabase.from('teachers').select('id, name').order('name'),
        supabase.from('subjects').select('id, name').order('name'),
        supabase.from('teacher_subjects').select('teacher_id, subject_id, class_id'),
        supabase.from('classes').select('id, name').order('name'),
        supabase.from('class_subjects').select('class_id, subject_id'),
      ]);

      if (teachersRes.error) throw teachersRes.error;
      if (subjectsRes.error) throw subjectsRes.error;
      if (linksRes.error) throw linksRes.error;

      const subjectMap = new Map((subjectsRes.data || []).map((s) => [s.id, s.name]));
      const links = (linksRes.data || []) as { teacher_id: string; subject_id: string; class_id: string }[];
      const classMap = new Map((classesRes.data || []).map((c) => [c.id, c.name]));
      setClasses(classesRes.data || []);
      setClassSubjects(csRes.data || []);

      setTeachers(
        (teachersRes.data || []).map((t) => ({
          ...t,
          links: links.filter((l) => l.teacher_id === t.id).map((l) => ({ subject_id: l.subject_id, class_id: l.class_id })),
          subjects: [...new Set(links.filter((l) => l.teacher_id === t.id).map((l) => l.subject_id))]
            .map((sid) => ({
              id: sid,
              name: subjectMap.get(sid) || '',
              classes: links.filter((l) => l.teacher_id === t.id && l.subject_id === sid && l.class_id)
                .map((l) => classMap.get(l.class_id) || '').filter(Boolean).sort(),
            }))
            .filter((s) => s.name),
        }))
      );
      setSubjects(subjectsRes.data || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      toast({
        title: "Error",
        description: "Failed to load teachers.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleKey = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };
  const classesForSubject = (subjectId: string) =>
    classes.filter((c) => classSubjects.some((cs) => cs.subject_id === subjectId && cs.class_id === c.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teacherName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a teacher name.",
        variant: "destructive",
      });
      return;
    }

    try {
      let teacherId = editingTeacher?.id;

      if (editingTeacher) {
        const { error } = await supabase
          .from('teachers')
          .update({ name: teacherName.trim() })
          .eq('id', editingTeacher.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('teachers')
          .insert({ name: teacherName.trim() })
          .select('id')
          .single();

        if (error) throw error;
        teacherId = data.id;
      }

      // Sync subject links
      const { error: delError } = await supabase
        .from('teacher_subjects')
        .delete()
        .eq('teacher_id', teacherId!);
      if (delError) throw delError;

      if (selected.length > 0) {
        const { error: insError } = await supabase
          .from('teacher_subjects')
          .insert(selected.map((k) => { const [subject_id, class_id] = k.split('|'); return { teacher_id: teacherId!, subject_id, class_id }; }));
        if (insError) throw insError;
      }

      toast({
        title: "Success",
        description: editingTeacher ? "Teacher updated successfully." : "Teacher added successfully.",
      });

      resetForm();
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving teacher:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save teacher.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setTeacherName(teacher.name);
    setSelected(teacher.links.map((l) => `${l.subject_id}|${l.class_id}`));
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('teachers').delete().eq('id', id);
      if (error) throw error;

      toast({ title: "Success", description: "Teacher deleted successfully." });
      fetchData();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      toast({
        title: "Error",
        description: "Failed to delete teacher.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingTeacher(null);
    setTeacherName('');
    setSelected([]);
  };

  const filteredTeachers = teachers.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout title="Teacher Management" description="Add, edit, and manage teacher records">
      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Teachers ({teachers.length})
            </CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search teachers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Teacher
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Teacher Name *</label>
                      <Input
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        placeholder="Enter teacher's name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        Subjects Taught
                      </label>
                      <div className="space-y-3 rounded-md border p-3 max-h-80 overflow-y-auto">
                        {subjects.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No subjects available.</p>
                        ) : (
                          subjects.map((subject) => {
                            const cls = classesForSubject(subject.id);
                            return (
                              <div key={subject.id} className="space-y-1.5">
                                <p className="text-sm font-semibold text-foreground">{subject.name}</p>
                                {cls.length === 0 ? (
                                  <p className="text-xs text-muted-foreground pl-1">Fasal looma xirin maadadan</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2 pl-1">
                                    {cls.map((c) => {
                                      const key = `${subject.id}|${c.id}`;
                                      return (
                                        <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer rounded-md border px-2 py-1 hover:bg-muted">
                                          <Checkbox checked={selected.includes(key)} onCheckedChange={() => toggleKey(key)} />
                                          {c.name}
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selected.length} fasal/maado la doortay
                      </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingTeacher ? 'Update' : 'Add'} Teacher
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="text-center py-12">
              <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">No Teachers Found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try a different search term' : 'Add your first teacher to get started'}
              </p>
            </div>
          ) : (
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subjects</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                    <TableCell>
                      {teacher.subjects.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No subjects assigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {teacher.subjects.map((s) => (
                            <Badge key={s.id} variant="secondary" className="text-xs">
                              {s.name}{s.classes.length > 0 && ` (${s.classes.join(', ')})`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEdit(teacher)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Teacher</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {teacher.name}?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(teacher.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default Teachers;
