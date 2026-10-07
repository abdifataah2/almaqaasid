import { useState, useEffect, useRef } from 'react';
import { Plus, Upload, Pencil, Trash2, Search, Users, Key, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Student {
  id: string;
  full_name: string;
  registration_number: string;
  class_id: string | null;
  class_name?: string;
  has_password?: boolean;
}

interface ClassOption {
  id: string;
  name: string;
}

const Students = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [passwordStudent, setPasswordStudent] = useState<Student | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isDeleteMultipleOpen, setIsDeleteMultipleOpen] = useState(false);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [classId, setClassId] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          full_name,
          registration_number,
          class_id,
          classes (name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setStudents(
        (data || []).map((s: any) => ({
          id: s.id,
          full_name: s.full_name,
          registration_number: s.registration_number,
          class_id: s.class_id,
          class_name: s.classes?.name,
          has_password: false,
        }))

      );
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: "Error",
        description: "Failed to load students.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !regNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingStudent) {
        const { error } = await supabase
          .from('students')
          .update({
            full_name: fullName.trim(),
            registration_number: regNumber.trim(),
            class_id: classId || null,
          })
          .eq('id', editingStudent.id);

        if (error) throw error;

        toast({ title: "Success", description: "Student updated successfully." });
      } else {
        const { error } = await supabase
          .from('students')
          .insert({
            full_name: fullName.trim(),
            registration_number: regNumber.trim(),
            class_id: classId || null,
          });

        if (error) {
          if (error.code === '23505') {
            toast({
              title: "Duplicate Registration",
              description: "A student with this registration number already exists.",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }

        toast({ title: "Success", description: "Student added successfully." });
      }

      resetForm();
      setIsDialogOpen(false);
      fetchStudents();
    } catch (error: any) {
      console.error('Error saving student:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save student.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFullName(student.full_name);
    setRegNumber(student.registration_number);
    setClassId(student.class_id || '');
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;

      toast({ title: "Success", description: "Student deleted successfully." });
      fetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({
        title: "Error",
        description: "Failed to delete student.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMultiple = async () => {
    if (selectedStudents.size === 0) return;

    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .in('id', Array.from(selectedStudents));
      
      if (error) throw error;

      toast({ 
        title: "Success", 
        description: `${selectedStudents.size} students deleted successfully.` 
      });
      setSelectedStudents(new Set());
      setIsDeleteMultipleOpen(false);
      fetchStudents();
    } catch (error) {
      console.error('Error deleting students:', error);
      toast({
        title: "Error",
        description: "Failed to delete students.",
        variant: "destructive",
      });
    }
  };

  const toggleSelectStudent = (id: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedStudents(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const handleSetPassword = (student: Student) => {
    setPasswordStudent(student);
    setNewPassword('');
    setIsPasswordDialogOpen(true);
  };

  const handleSavePassword = async () => {
    if (!passwordStudent) return;
    
    if (!newPassword.trim() || newPassword.length < 4) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 4 characters.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .update({ password_hash: newPassword.trim() })
        .eq('id', passwordStudent.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Password set for ${passwordStudent.full_name}.`,
      });
      setIsPasswordDialogOpen(false);
      setPasswordStudent(null);
      setNewPassword('');
      fetchStudents();
    } catch (error) {
      console.error('Error setting password:', error);
      toast({
        title: "Error",
        description: "Failed to set password.",
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Skip header row
        const dataLines = lines.slice(1);
        const studentsToImport = [];

        for (const line of dataLines) {
          const [name, regNum, className] = line.split(',').map(s => s.trim().replace(/"/g, ''));
          if (name && regNum) {
            // Find class by name if provided - normalize by removing spaces for comparison
            let foundClassId: string | null = null;
            if (className) {
              const normalizedClassName = className.toLowerCase().replace(/\s+/g, '');
              const matchedClass = classes.find(c => 
                c.name.toLowerCase().replace(/\s+/g, '') === normalizedClassName
              );
              if (matchedClass) {
                foundClassId = matchedClass.id;
              }
            }
            
            studentsToImport.push({
              full_name: name,
              registration_number: regNum,
              class_id: foundClassId,
            });
          }
        }

        if (studentsToImport.length === 0) {
          toast({
            title: "No Data",
            description: "No valid student data found in the file.",
            variant: "destructive",
          });
          return;
        }

        const { error } = await supabase
          .from('students')
          .insert(studentsToImport);

        if (error) throw error;

        toast({
          title: "Import Successful",
          description: `${studentsToImport.length} students imported successfully.`,
        });
        fetchStudents();
      } catch (error: any) {
        console.error('Error importing students:', error);
        toast({
          title: "Import Failed",
          description: error.message || "Failed to import students.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setEditingStudent(null);
    setFullName('');
    setRegNumber('');
    setClassId('');
  };

  const handleExportCSV = () => {
    const sorted = [...students].sort((a, b) => {
      const ca = (a.class_name || '').localeCompare(b.class_name || '');
      if (ca !== 0) return ca;
      return a.full_name.localeCompare(b.full_name);
    });
    const header = 'Full Name,Registration Number,Class\n';
    const rows = sorted.map(s => {
      const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
      return `${esc(s.full_name)},${esc(s.registration_number)},${esc(s.class_name || '')}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Export Successful', description: `${students.length} ardey ayaa la soo dejiyay.` });
  };

  const filteredStudents = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.registration_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout title="Student Management" description="Add, edit, and manage student records">
      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Students ({students.length})
            </CardTitle>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {selectedStudents.size > 0 && (
                  <AlertDialog open={isDeleteMultipleOpen} onOpenChange={setIsDeleteMultipleOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full sm:w-auto">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete ({selectedStudents.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Multiple Students</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {selectedStudents.size} students? This will also delete all their results. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteMultiple}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete All
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button 
                  variant="outline" 
                  onClick={handleExportCSV}
                  disabled={students.length === 0}
                  className="w-full sm:w-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) resetForm();
                }}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Student
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingStudent ? 'Edit Student' : 'Add New Student'}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Full Name *</label>
                        <Input
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Enter student's full name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Registration Number *</label>
                        <Input
                          value={regNumber}
                          onChange={(e) => setRegNumber(e.target.value)}
                          placeholder="e.g., STU/2024/001"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Class (Optional)</label>
                        <Select value={classId} onValueChange={setClassId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a class" />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingStudent ? 'Update' : 'Add'} Student
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">No Students Found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try a different search term' : 'Add your first student to get started'}
              </p>
            </div>
          ) : (
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filteredStudents.length > 0 && selectedStudents.size === filteredStudents.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Registration Number</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedStudents.has(student.id)}
                        onCheckedChange={() => toggleSelectStudent(student.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{student.full_name}</TableCell>
                    <TableCell>{student.registration_number}</TableCell>
                    <TableCell>{student.class_name || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          title="Set Password"
                          onClick={() => handleSetPassword(student)}
                          className={student.has_password ? 'text-success' : 'text-muted-foreground'}
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEdit(student)}
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
                              <AlertDialogTitle>Delete Student</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {student.full_name}? This will also delete all their results.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(student.id)}
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

      {/* Import Instructions */}
      <Card className="mt-6 shadow-md">
        <CardHeader className="py-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4" />
            CSV Import Format
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <p className="text-sm text-muted-foreground">
            Upload a CSV file with the following columns: <code className="bg-muted px-2 py-1 rounded">Full Name, Registration Number, Class Name</code>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Example: John Doe, STU/2024/001, Grade 10A
          </p>
        </CardContent>
      </Card>

      {/* Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Set Student Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Set a password for <span className="font-semibold text-foreground">{passwordStudent?.full_name}</span> ({passwordStudent?.registration_number})
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter password (min 4 characters)"
                onKeyDown={(e) => e.key === 'Enter' && handleSavePassword()}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePassword}>
                Save Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Students;
