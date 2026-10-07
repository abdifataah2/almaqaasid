import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, ClipboardList, Save, Trash2, Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import AdminLayout from '@/components/admin/AdminLayout';
import ResultsImport from '@/components/admin/ResultsImport';
import ClassResultsSection from '@/components/admin/ClassResultsSection';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Student {
  id: string;
  full_name: string;
  registration_number: string;
  class_id: string | null;
}

interface ClassOption {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
}

interface ClassSubject {
  subject_id: string;
  subjects: { id: string; name: string } | null;
}

interface ResultEntry {
  id?: string;
  student_id: string;
  student_name: string;
  registration_number: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  marks: number;
  term: string;
  academic_year: string;
}

interface GroupedResult {
  student_id: string;
  student_name: string;
  registration_number: string;
  class_name: string;
  subject_name: string;
  subject_id: string;
  academic_year: string;
  term1: number | null;
  total: number | null;
  result_ids: string[];
}

const Results = () => {
  const { toast } = useToast();
  const { isAdmin, teacherAssignments } = useAuth();
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form state - marks organized by subject (Term 1 only)
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [subjectMarks, setSubjectMarks] = useState<Record<string, { term1: string }>>({});
  const [academicYear, setAcademicYear] = useState('2025-2026');

  // Fetch all results with pagination (Supabase limits to 1000 rows per request)
  const fetchAllResults = async () => {
    const allResults: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('results')
        .select(`
          id,
          student_id,
          class_id,
          subject_id,
          marks,
          term,
          academic_year,
          students (full_name, registration_number),
          classes (name),
          subjects (name)
        `)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allResults.push(...data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allResults;
  };

  const fetchData = async () => {
    try {
      const [studentsRes, classesRes, subjectsRes, classSubjectsRes, allResultsData] = await Promise.all([
        supabase.from('students').select('id, full_name, registration_number, class_id').order('full_name'),
        supabase.from('classes').select('id, name').order('name'),
        supabase.from('subjects').select('id, name').order('name'),
        supabase.from('class_subjects').select('subject_id, subjects (id, name)'),
        fetchAllResults(),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (classesRes.error) throw classesRes.error;
      if (subjectsRes.error) throw subjectsRes.error;
      if (classSubjectsRes.error) throw classSubjectsRes.error;

      setStudents(studentsRes.data || []);
      setClasses(classesRes.data || []);
      setClassSubjects(classSubjectsRes.data as ClassSubject[] || []);
      setSubjects(subjectsRes.data || []);
      setResults(
        allResultsData.map((r: any) => ({
          id: r.id,
          student_id: r.student_id,
          student_name: r.students?.full_name || 'Unknown',
          registration_number: r.students?.registration_number || 'Unknown',
          class_id: r.class_id,
          class_name: r.classes?.name || 'Unknown',
          subject_id: r.subject_id,
          subject_name: r.subjects?.name || 'Unknown',
          marks: r.marks,
          term: r.term,
          academic_year: r.academic_year,
        }))
      );
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Debounce the search box so typing stays smooth with large data sets
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);



  // When student is selected, auto-fill class and filter subjects
  useEffect(() => {
    if (selectedStudent) {
      const student = students.find((s) => s.id === selectedStudent);
      if (student?.class_id) {
        setSelectedClass(student.class_id);
      }
    }
  }, [selectedStudent, students]);

  // Fetch subjects for the selected class
  useEffect(() => {
    const fetchSubjectsForClass = async () => {
      if (selectedClass) {
        const { data, error } = await supabase
          .from('class_subjects')
          .select('subject_id, subjects (id, name)')
          .eq('class_id', selectedClass);
        
        if (!error && data) {
          const subjectsForClass = data
            .map((cs: any) => cs.subjects)
            .filter((s: any) => s !== null) as Subject[];
          setFilteredSubjects(isAdmin ? subjectsForClass : subjectsForClass.filter((s) => teacherAssignments.some((a) => a.subject_id === s.id && a.class_id === selectedClass)));
        }
      } else {
        setFilteredSubjects([]);
      }
      setSubjectMarks({});
    };
    
    fetchSubjectsForClass();
  }, [selectedClass]);

  const getStudentInfo = (studentId: string) => {
    return students.find((s) => s.id === studentId);
  };
  
  const getClassName = (classId: string) => {
    return classes.find((c) => c.id === classId)?.name || '';
  };

  // Group results by student + subject + academic_year
  const groupedResults = useMemo(() => {
    const groups = new Map<string, GroupedResult>();
    
    results.forEach((r) => {
      const key = `${r.student_id}-${r.subject_id}-${r.academic_year}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          student_id: r.student_id,
          student_name: r.student_name,
          registration_number: r.registration_number,
          class_name: r.class_name,
          subject_name: r.subject_name,
          subject_id: r.subject_id,
          academic_year: r.academic_year,
          term1: null,
          total: null,
          result_ids: [],
        });
      }
      
      const group = groups.get(key)!;
      if (r.id) group.result_ids.push(r.id);
      
      if (r.term === 'Term 1') group.term1 = r.marks;
    });
    
    // Calculate totals (Term 1 only)
    groups.forEach((group) => {
      if (group.term1 !== null) {
        group.total = group.term1;
      }
    });
    
    return Array.from(groups.values());
  }, [results]);

  // Get unique academic years for filter
  const availableYears = useMemo(() => {
    const years = new Set(groupedResults.map(r => r.academic_year));
    return Array.from(years).sort().reverse();
  }, [groupedResults]);

  const filteredGroupedResults = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q && filterYear === 'all') return groupedResults;
    return groupedResults.filter((r) => {
      const matchesSearch =
        !q ||
        r.student_name.toLowerCase().includes(q) ||
        r.registration_number.toLowerCase().includes(q) ||
        r.subject_name.toLowerCase().includes(q);

      const matchesYear = filterYear === 'all' || r.academic_year === filterYear;

      return matchesSearch && matchesYear;
    });
  }, [groupedResults, debouncedSearch, filterYear]);

  // Group results by class for the new view
  const resultsByClass = useMemo(() => {
    const classMap = new Map<string, typeof filteredGroupedResults>();
    
    filteredGroupedResults.forEach((result) => {
      if (!classMap.has(result.class_name)) {
        classMap.set(result.class_name, []);
      }
      classMap.get(result.class_name)!.push(result);
    });
    
    // Sort classes alphabetically
    const sortedClasses = Array.from(classMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    return sortedClasses;
  }, [filteredGroupedResults]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStudent || !selectedClass) {
      toast({
        title: "Validation Error",
        description: "Please select a student.",
        variant: "destructive",
      });
      return;
    }

    // Collect all marks entries (Term 1 only)
    const marksEntries: { subjectId: string; period: string; marks: number }[] = [];
    
    for (const [subjectId, periods] of Object.entries(subjectMarks)) {
      if (periods.term1) {
        const val = parseFloat(periods.term1);
        if (!isNaN(val) && val >= 0 && val <= 100) {
          marksEntries.push({ subjectId, period: 'Term 1', marks: val });
        } else if (periods.term1 !== '') {
          const subject = filteredSubjects.find(s => s.id === subjectId);
          toast({ title: "Validation Error", description: `Term1 marks for ${subject?.name || 'subject'} must be between 0 and 100.`, variant: "destructive" });
          return;
        }
      }
    }

    if (marksEntries.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please enter marks for at least one subject.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare all results to upsert
      const resultsToSave = marksEntries.map((entry) => ({
        student_id: selectedStudent,
        class_id: selectedClass,
        subject_id: entry.subjectId,
        marks: entry.marks,
        term: entry.period,
        academic_year: academicYear,
      }));

      const { error } = await supabase
        .from('results')
        .upsert(resultsToSave, {
          onConflict: 'student_id,subject_id,term,academic_year',
        });

      if (error) throw error;

      toast({ title: "Success", description: `${marksEntries.length} result(s) saved successfully.` });
      resetForm();
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving results:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save results.",
        variant: "destructive",
      });
    }
  };

  // Helper function to delete in batches to avoid URL length limits
  const deleteInBatches = async (ids: string[], batchSize: number = 50) => {
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const { error } = await supabase.from('results').delete().in('id', batch);
      if (error) throw error;
    }
  };

  const handleDeleteGroup = async (resultIds: string[]) => {
    try {
      await deleteInBatches(resultIds);

      toast({ title: "Success", description: "Results deleted successfully." });
      fetchData();
    } catch (error) {
      console.error('Error deleting results:', error);
      toast({
        title: "Error",
        description: "Failed to delete results.",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    // Get all result IDs from selected groups
    const allResultIds: string[] = [];
    filteredGroupedResults.forEach((group) => {
      const groupKey = `${group.student_id}-${group.subject_id}-${group.academic_year}`;
      if (selectedIds.has(groupKey)) {
        allResultIds.push(...group.result_ids);
      }
    });

    if (allResultIds.length === 0) return;

    try {
      await deleteInBatches(allResultIds);

      toast({ title: "Success", description: `${selectedIds.size} result group(s) deleted successfully.` });
      setSelectedIds(new Set());
      fetchData();
    } catch (error) {
      console.error('Error deleting results:', error);
      toast({
        title: "Error",
        description: "Failed to delete results.",
        variant: "destructive",
      });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredGroupedResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredGroupedResults.map(r => `${r.student_id}-${r.subject_id}-${r.academic_year}`)));
    }
  };

  const toggleSelect = (groupKey: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(groupKey)) {
      newSet.delete(groupKey);
    } else {
      newSet.add(groupKey);
    }
    setSelectedIds(newSet);
  };

  const resetForm = () => {
    setSelectedStudent('');
    setStudentSearch('');
    setSelectedClass('');
    setSubjectMarks({});
    setAcademicYear('2025-2026');
  };

  const handleExportExcel = async () => {
    if (filteredGroupedResults.length === 0) {
      toast({
        title: "No Data",
        description: "There are no results to export.",
        variant: "destructive",
      });
      return;
    }

    const XLSX = await import('xlsx');
    const exportData = filteredGroupedResults.map((r) => ({
      'Reg No.': r.registration_number,
      'Subject': r.subject_name,
      'Term1': r.term1 ?? '',
      'Total': r.total ?? '',
      'Academic Year': r.academic_year,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Reg No
      { wch: 20 }, // Subject
      { wch: 10 }, // Term1
      { wch: 10 }, // Total
      { wch: 15 }, // Academic Year
    ];

    XLSX.writeFile(wb, `Results_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Exported",
      description: "Results exported to Excel successfully.",
    });
  };

  const selectedStudentInfo = getStudentInfo(selectedStudent);

  // Check if class is Form 4 or Class 8 (for different failed threshold and grade display)
  const isForm4OrClass8 = (className: string) => {
    const lowerClassName = className.toLowerCase();
    return lowerClassName.includes('form 4') || lowerClassName.includes('form4') || 
           lowerClassName.includes('class 8') || lowerClassName.includes('class8');
  };

  // Get failed threshold based on class
  const getFailedThreshold = (className: string) => {
    return isForm4OrClass8(className) ? 50 : 25;
  };

  const getGrade = (marks: number | null) => {
    if (marks === null) return null;
    if (marks >= 80) return { grade: 'A', color: 'bg-green-500' };
    if (marks >= 60) return { grade: 'B', color: 'bg-blue-500' };
    if (marks >= 40) return { grade: 'C', color: 'bg-yellow-500' };
    return { grade: 'F', color: 'bg-red-500' };
  };

  return (
    <AdminLayout title="Result Management" description="Add and manage student results">
      <Card className="shadow-lg">
        <CardHeader className="border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex min-w-0 items-start gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Results ({filteredGroupedResults.length} records)
            </CardTitle>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search results..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExportExcel} className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              {isAdmin && <ResultsImport onImportComplete={fetchData} />}
              {selectedIds.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete ({selectedIds.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Selected Results</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedIds.size} selected result group(s)? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleBulkDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Result
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Student Result</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Student *</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Qor magaca ama reg numberka ardayga..."
                          value={selectedStudent ? `${selectedStudentInfo?.full_name || ''} (${selectedStudentInfo?.registration_number || ''})` : studentSearch}
                          onChange={(e) => {
                            setSelectedStudent('');
                            setStudentSearch(e.target.value);
                          }}
                          className="pl-9"
                        />
                      </div>
                      {!selectedStudent && studentSearch.trim() !== '' && (
                        <div className="max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
                          {students
                            .filter((s) =>
                              s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                              s.registration_number.toLowerCase().includes(studentSearch.toLowerCase())
                            )
                            .slice(0, 20)
                            .map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => setSelectedStudent(s.id)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                              >
                                <span className="truncate font-medium">{s.full_name}</span>
                                <span className="shrink-0 text-muted-foreground">{s.registration_number}</span>
                              </button>
                            ))}
                          {students.filter((s) =>
                            s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                            s.registration_number.toLowerCase().includes(studentSearch.toLowerCase())
                          ).length === 0 && (
                            <p className="px-3 py-2 text-sm text-muted-foreground">Arday lama helin</p>
                          )}
                        </div>
                      )}
                    </div>

                    {selectedStudentInfo && (
                      <div className="p-3 bg-muted/50 rounded-lg text-sm">
                        <p><span className="font-medium">Name:</span> {selectedStudentInfo.full_name}</p>
                        <p><span className="font-medium">Reg No:</span> {selectedStudentInfo.registration_number}</p>
                        <p><span className="font-medium">Class:</span> {selectedStudentInfo.class_id ? getClassName(selectedStudentInfo.class_id) : 'Not assigned'}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Academic Year</label>
                      <Select value={academicYear} onValueChange={setAcademicYear}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2024-2025">2024-2025</SelectItem>
                          <SelectItem value="2025-2026">2025-2026</SelectItem>
                          <SelectItem value="2026-2027">2026-2027</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedStudentInfo && filteredSubjects.length > 0 && (
                      <div className="space-y-3">
                        <label className="text-sm font-medium">Enter Marks for Each Subject</label>
                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                          {filteredSubjects.map((subject) => {
                            const marks = subjectMarks[subject.id] || { term1: '' };
                            return (
                              <div key={subject.id} className="p-3 border rounded-lg space-y-2">
                                <label className="text-sm font-semibold text-foreground">{subject.name}</label>
                                <div className="space-y-1">
                                  <label className="text-xs text-muted-foreground">Term1</label>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={marks.term1}
                                    onChange={(e) => setSubjectMarks(prev => ({
                                      ...prev,
                                      [subject.id]: { term1: e.target.value }
                                    }))}
                                    placeholder="0-100"
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {selectedStudentInfo && filteredSubjects.length === 0 && (
                      <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                        No subjects assigned to this class.
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={!selectedStudent || filteredSubjects.length === 0}>
                        <Save className="h-4 w-4 mr-2" />
                        Save All Results
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
          ) : filteredGroupedResults.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">No Results Found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try a different search term' : 'Add your first result to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 p-2 sm:p-4">
              {resultsByClass.map(([className, classResults]) => (
                <ClassResultsSection
                  key={className}
                  className={className}
                  results={classResults}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onDeleteGroup={handleDeleteGroup}
                  isForm4OrClass8={isForm4OrClass8}
                  getFailedThreshold={getFailedThreshold}
                  getGrade={getGrade}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default Results;
