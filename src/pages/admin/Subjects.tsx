import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, BookOpen, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Subject {
  id: string;
  name: string;
  classes?: { id: string; name: string }[];
}

interface ClassOption {
  id: string;
  name: string;
}

const Subjects = () => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  const fetchClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchSubjects = async () => {
    try {
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name')
        .order('name');

      if (subjectsError) throw subjectsError;

      // Fetch class associations for each subject
      const { data: classSubjectsData, error: classSubjectsError } = await supabase
        .from('class_subjects')
        .select('subject_id, class_id, classes(id, name)');

      if (classSubjectsError) throw classSubjectsError;

      // Map classes to subjects
      const subjectsWithClasses = (subjectsData || []).map((subject) => {
        const subjectClasses = (classSubjectsData || [])
          .filter((cs) => cs.subject_id === subject.id)
          .map((cs) => cs.classes as unknown as { id: string; name: string })
          .filter(Boolean);
        return { ...subject, classes: subjectClasses };
      });

      setSubjects(subjectsWithClasses);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast({
        title: "Error",
        description: "Failed to load subjects.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subjectName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a subject name.",
        variant: "destructive",
      });
      return;
    }

    if (selectedClasses.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one class.",
        variant: "destructive",
      });
      return;
    }

    try {
      let subjectId: string;

      if (editingSubject) {
        const { error } = await supabase
          .from('subjects')
          .update({ name: subjectName.trim() })
          .eq('id', editingSubject.id);

        if (error) throw error;
        subjectId = editingSubject.id;

        // Remove existing class associations
        await supabase
          .from('class_subjects')
          .delete()
          .eq('subject_id', editingSubject.id);
      } else {
        const { data, error } = await supabase
          .from('subjects')
          .insert({ name: subjectName.trim() })
          .select('id')
          .single();

        if (error) throw error;
        subjectId = data.id;
      }

      // Insert new class associations
      const classSubjects = selectedClasses.map((classId) => ({
        subject_id: subjectId,
        class_id: classId,
      }));

      const { error: linkError } = await supabase
        .from('class_subjects')
        .insert(classSubjects);

      if (linkError) throw linkError;

      toast({ 
        title: "Success", 
        description: editingSubject ? "Subject updated successfully." : "Subject added successfully." 
      });

      resetForm();
      setIsDialogOpen(false);
      fetchSubjects();
    } catch (error: any) {
      console.error('Error saving subject:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save subject.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (subject: Subject) => {
    setEditingSubject(subject);
    setSubjectName(subject.name);
    setSelectedClasses(subject.classes?.map((c) => c.id) || []);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;

      toast({ title: "Success", description: "Subject deleted successfully." });
      fetchSubjects();
    } catch (error) {
      console.error('Error deleting subject:', error);
      toast({
        title: "Error",
        description: "Failed to delete subject.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingSubject(null);
    setSubjectName('');
    setSelectedClasses([]);
  };

  const toggleClass = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const filteredSubjects = subjects.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = async () => {
    try {
      toast({ title: 'Preparing export…', description: 'Fetching all subjects and results.' });

      const { data, error } = await supabase
        .from('results')
        .select('term1, academic_year, subjects(name), students(full_name, registration_number, classes(name))')
        .order('academic_year', { ascending: false });

      if (error) throw error;

      const rows = (data || []).map((r: any) => ({
        subject: r.subjects?.name ?? '',
        class: r.students?.classes?.name ?? '',
        registration_number: r.students?.registration_number ?? '',
        full_name: r.students?.full_name ?? '',
        term1: r.term1 ?? '',
        academic_year: r.academic_year ?? '',
      }));

      rows.sort((a, b) =>
        a.subject.localeCompare(b.subject) ||
        a.class.localeCompare(b.class) ||
        a.full_name.localeCompare(b.full_name)
      );

      const escape = (v: any) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ['Subject', 'Class', 'Registration Number', 'Full Name', 'Term 1 Mark', 'Academic Year'];
      const csv = [
        header.join(','),
        ...rows.map((r) =>
          [r.subject, r.class, r.registration_number, r.full_name, r.term1, r.academic_year].map(escape).join(',')
        ),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `almaqaasid-subjects-results-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export complete',
        description: `${rows.length} result rows across ${subjects.length} subjects exported.`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error.message || 'Could not export subjects and results.',
        variant: 'destructive',
      });
    }
  };

  return (
    <AdminLayout title="Subject Management" description="Add, edit, and manage subjects">
      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Subjects ({subjects.length})
            </CardTitle>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <Button variant="outline" onClick={handleExportCSV} className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Subject
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingSubject ? 'Edit Subject' : 'Add New Subject'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subject Name *</label>
                      <Input
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        placeholder="e.g., Mathematics, English, Science"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Assign to Classes *</label>
                      <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                        {classes.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No classes available. Please add classes first.</p>
                        ) : (
                          classes.map((cls) => (
                            <div key={cls.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={cls.id}
                                checked={selectedClasses.includes(cls.id)}
                                onCheckedChange={() => toggleClass(cls.id)}
                              />
                              <label
                                htmlFor={cls.id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {cls.name}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={classes.length === 0}>
                        {editingSubject ? 'Update' : 'Add'} Subject
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
          ) : filteredSubjects.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">No Subjects Found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try a different search term' : 'Add your first subject to get started'}
              </p>
            </div>
          ) : (
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Subject Name</TableHead>
                  <TableHead>Assigned Classes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {subject.classes && subject.classes.length > 0 ? (
                          subject.classes.map((cls) => (
                            <Badge key={cls.id} variant="secondary">
                              {cls.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">No classes assigned</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEdit(subject)}
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
                              <AlertDialogTitle>Delete Subject</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {subject.name}? This may affect existing results.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(subject.id)}
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

export default Subjects;
