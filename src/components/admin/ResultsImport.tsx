import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ImportRow {
  student_name: string;
  registration_number: string;
  class_name: string;
  subject_name: string;
  term1: number | null;
  academic_year: string;
  status?: 'valid' | 'error';
  error?: string;
}

interface ResolvedRow extends ImportRow {
  student_id: string;
  class_id: string;
  subject_id: string;
}

interface ResultsImportProps {
  onImportComplete: () => void;
}

const ResultsImport = ({ onImportComplete }: ResultsImportProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [resolvedData, setResolvedData] = useState<ResolvedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const downloadTemplate = () => {
    const headers = ['registration_number', 'subject_name', 'term2', 'academic_year'];
    const sampleData = [
      ['REG001', 'Mathematics', '80', '2025-2026'],
      ['REG001', 'English', '75', '2025-2026'],
      ['REG002', 'Mathematics', '65', '2025-2026'],
    ];
    
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'results_import_template.csv';
    link.click();
  };

  const parseCSV = (text: string): ImportRow[] => {
    const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const lines = clean.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["\s]+/g, ''));
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      const parseMarks = (val?: string) => {
        if (!val || val === '') return null;
        const num = parseFloat(val);
        return isNaN(num) ? null : num;
      };
      
      return {
        student_name: '',
        registration_number: row.registration_number || row.reg_no || row.reg || row.registrationnumber || '',
        class_name: '',
        subject_name: row.subject_name || row.subject || row.subjectname || '',
        term1: parseMarks(row.term2 ?? row.term1 ?? row.marks ?? row.mark),
        academic_year: row.academic_year || row.academicyear || row.year || '2025-2026',
      };
    });
  };

  const validateAndResolve = async (data: ImportRow[]) => {
    const [studentsRes, classesRes, subjectsRes] = await Promise.all([
      supabase.from('students').select('id, full_name, registration_number, class_id'),
      supabase.from('classes').select('id, name'),
      supabase.from('subjects').select('id, name'),
    ]);

    const students = studentsRes.data || [];
    const classes = classesRes.data || [];
    const subjects = subjectsRes.data || [];

    const studentsMap = new Map(students.map(s => [
      s.registration_number.toLowerCase().replace(/\s+/g, ''), 
      s
    ]));
    const classesMap = new Map(classes.map(c => [c.id, c]));
    const subjectsMap = new Map(subjects.map(s => [s.name.toLowerCase().replace(/\s+/g, ''), s]));

    const resolved: ResolvedRow[] = [];
    const errorsList: string[] = [];

    data.forEach((row, index) => {
      const rowNum = index + 2;
      const rowErrors: string[] = [];

      const normalizedRegNo = row.registration_number.toLowerCase().replace(/\s+/g, '');
      const student = studentsMap.get(normalizedRegNo);
      
      let studentName = '';
      let className = '';
      let classId = '';

      if (!student) {
        rowErrors.push(`Student "${row.registration_number}" not found`);
      } else {
        studentName = student.full_name;
        if (student.class_id) {
          const studentClass = classesMap.get(student.class_id);
          if (studentClass) {
            className = studentClass.name;
            classId = studentClass.id;
          } else {
            rowErrors.push(`Class not found`);
          }
        } else {
          rowErrors.push(`No class assigned`);
        }
      }

      const normalizedSubject = row.subject_name.toLowerCase().replace(/\s+/g, '');
      const subject = subjectsMap.get(normalizedSubject);
      if (!subject) {
        rowErrors.push(`Subject "${row.subject_name}" not found`);
      }

      // Validate marks (0-100, allow null/empty)
      if (row.term1 !== null && (row.term1 < 0 || row.term1 > 100)) {
        rowErrors.push('Term2 must be 0-100');
      }

      // Term2 mark is required
      if (row.term1 === null) {
        rowErrors.push('Term2 mark is required');
      }

      if (rowErrors.length > 0) {
        errorsList.push(`Row ${rowNum}: ${rowErrors.join(', ')}`);
        resolved.push({
          ...row,
          student_name: studentName,
          class_name: className,
          student_id: student?.id || '',
          class_id: classId,
          subject_id: subject?.id || '',
          status: 'error',
          error: rowErrors.join(', '),
        });
      } else {
        resolved.push({
          ...row,
          student_name: studentName,
          class_name: className,
          student_id: student!.id,
          class_id: classId,
          subject_id: subject!.id,
          status: 'valid',
        });
      }
    });

    return { resolved, errors: errorsList };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCSV(text);
    setPreviewData(parsed);

    if (parsed.length > 0) {
      const { resolved, errors: validationErrors } = await validateAndResolve(parsed);
      setResolvedData(resolved);
      setErrors(validationErrors);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    const validRows = resolvedData.filter(r => r.status === 'valid');
    if (validRows.length === 0) {
      toast({
        title: "No valid rows",
        description: "Please fix the errors before importing.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const resultsToInsert: any[] = [];
      
      validRows.forEach(row => {
        const base = {
          student_id: row.student_id,
          class_id: row.class_id,
          subject_id: row.subject_id,
          academic_year: row.academic_year,
        };
        
        if (row.term1 !== null) resultsToInsert.push({ ...base, marks: row.term1, term: 'Term 1' });
      });

      const { error } = await supabase
        .from('results')
        .upsert(resultsToInsert, {
          onConflict: 'student_id,subject_id,term,academic_year',
        });

      if (error) throw error;

      toast({
        title: "Import Successful",
        description: `${resultsToInsert.length} result(s) imported successfully.`,
      });

      setPreviewData([]);
      setResolvedData([]);
      setErrors([]);
      setIsOpen(false);
      onImportComplete();
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import results.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const getGrade = (marks: number | null) => {
    if (marks === null) return { grade: '-', color: 'bg-gray-400' };
    if (marks >= 80) return { grade: 'A', color: 'bg-green-500' };
    if (marks >= 60) return { grade: 'B', color: 'bg-blue-500' };
    if (marks >= 40) return { grade: 'C', color: 'bg-yellow-500' };
    return { grade: 'F', color: 'bg-red-500' };
  };

  const validCount = resolvedData.filter(r => r.status === 'valid').length;
  const errorCount = resolvedData.filter(r => r.status === 'error').length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setPreviewData([]);
        setResolvedData([]);
        setErrors([]);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Results from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Select CSV File
              </Button>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              CSV columns: <strong>registration_number, subject_name, term2, academic_year</strong>.<br/>
              Student name & class auto-fill from reg number.
            </AlertDescription>
          </Alert>

          {resolvedData.length > 0 && (
            <>
              <div className="flex gap-4">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Valid: {validCount}
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Errors: {errorCount}
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 bg-background">Status</TableHead>
                      <TableHead className="sticky top-0 bg-background">Student</TableHead>
                      <TableHead className="sticky top-0 bg-background">Reg No</TableHead>
                      <TableHead className="sticky top-0 bg-background">Class</TableHead>
                      <TableHead className="sticky top-0 bg-background">Subject</TableHead>
                      <TableHead className="sticky top-0 bg-background text-center">Term2</TableHead>
                      <TableHead className="sticky top-0 bg-background">Year</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resolvedData.map((row, index) => (
                      <TableRow key={index} className={row.status === 'error' ? 'bg-destructive/10' : ''}>
                        <TableCell>
                          {row.status === 'valid' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <span className="text-destructive text-xs">{row.error}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{row.student_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.registration_number}</Badge>
                        </TableCell>
                        <TableCell>{row.class_name}</TableCell>
                        <TableCell>{row.subject_name}</TableCell>
                        <TableCell className="text-center font-semibold">{row.term1 ?? '-'}</TableCell>
                        <TableCell>{row.academic_year}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => {
                  setPreviewData([]);
                  setResolvedData([]);
                  setErrors([]);
                }}>
                  Clear
                </Button>
                <Button onClick={handleImport} disabled={importing || validCount === 0}>
                  {importing ? 'Importing...' : `Import ${validCount} Result(s)`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResultsImport;
