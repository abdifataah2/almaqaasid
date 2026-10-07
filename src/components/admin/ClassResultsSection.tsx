import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, Trophy, Medal, Award, Download } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';


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

interface StudentSummary {
  student_id: string;
  student_name: string;
  registration_number: string;
  totalMarks: number;
  subjectCount: number;
  average: number;
  rank: number;
  subjects: GroupedResult[];
}

interface ClassResultsSectionProps {
  className: string;
  results: GroupedResult[];
  selectedIds: Set<string>;
  onToggleSelect: (groupKey: string) => void;
  onDeleteGroup: (resultIds: string[]) => void;
  isForm4OrClass8: (className: string) => boolean;
  getFailedThreshold: (className: string) => number;
  getGrade: (marks: number | null) => { grade: string; color: string } | null;
}

const ClassResultsSection = ({
  className,
  results,
  selectedIds,
  onToggleSelect,
  onDeleteGroup,
  isForm4OrClass8,
  getFailedThreshold,
  getGrade,
}: ClassResultsSectionProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  // Group results by student and calculate rankings
  const studentSummaries: StudentSummary[] = useMemo(() => {
    const studentMap = new Map<string, StudentSummary>();

    results.forEach((result) => {
      if (!studentMap.has(result.student_id)) {
        studentMap.set(result.student_id, {
          student_id: result.student_id,
          student_name: result.student_name,
          registration_number: result.registration_number,
          totalMarks: 0,
          subjectCount: 0,
          average: 0,
          rank: 0,
          subjects: [],
        });
      }

      const student = studentMap.get(result.student_id)!;
      student.subjects.push(result);
      if (result.term1 !== null) {
        student.totalMarks += result.term1;
        student.subjectCount += 1;
      }
    });

    // Calculate averages
    studentMap.forEach((student) => {
      if (student.subjectCount > 0) {
        student.average = student.totalMarks / student.subjectCount;
      }
    });

    // Sort by average (descending), tie-break alphabetically by name
    const sorted = Array.from(studentMap.values()).sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average;
      return a.student_name.localeCompare(b.student_name);
    });
    sorted.forEach((student, index) => {
      student.rank = index + 1;
    });

    return sorted;
  }, [results]);

  const failedThreshold = getFailedThreshold(className);
  const showGrade = isForm4OrClass8(className);
  const totalStudents = studentSummaries.length;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-primary" />;
      case 2:
        return <Medal className="h-5 w-5 text-muted-foreground" />;
      case 3:
        return <Award className="h-5 w-5 text-primary" />;
      default:
        return null;
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-primary text-primary-foreground';
    if (rank === 2) return 'bg-muted-foreground text-primary-foreground';
    if (rank === 3) return 'bg-secondary text-secondary-foreground';
    return 'bg-muted text-muted-foreground';
  };

  // Export class results to Excel
  const handleExportClassExcel = async () => {
    const XLSX = await import('xlsx');
    const exportData: any[] = [];

    studentSummaries.forEach((student) => {
      // Create a row for each student with all their subjects
      const row: any = {
        'Rank': student.rank,
        'Name': student.student_name,
        'Reg No.': student.registration_number,
      };

      // Add each subject as a column
      student.subjects.forEach((subject) => {
        row[subject.subject_name] = subject.term1 ?? '';
      });

      row['Total'] = student.totalMarks.toFixed(1);
      row['Average'] = student.average.toFixed(1);
      
      if (showGrade) {
        const gradeInfo = getGrade(student.average);
        row['Grade'] = gradeInfo?.grade ?? '';
      }

      exportData.push(row);
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, className);

    XLSX.writeFile(wb, `${className}_Results_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: "Exported",
      description: `${className} results exported to Excel.`,
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="overflow-hidden rounded-lg border">
      <CollapsibleTrigger asChild>
        <div className="flex cursor-pointer flex-col gap-3 bg-muted/50 p-3 transition-colors hover:bg-muted/70 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            <h3 className="min-w-0 truncate text-base font-semibold sm:text-lg">{className}</h3>
            <Badge variant="secondary" className="shrink-0">{totalStudents} arday</Badge>
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-3">
            <span className="text-sm text-muted-foreground">
              {results.length} natiijoyin
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                handleExportClassExcel();
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 p-2 sm:space-y-4 sm:p-4">
          {studentSummaries.map((student) => (
            <div key={student.student_id} className="border rounded-lg overflow-hidden">
              {/* Student Header with Rank */}
              <div className="grid gap-3 border-b bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2">
                    {getRankIcon(student.rank)}
                    <Badge className={getRankBadge(student.rank)}>
                      #{student.rank}
                    </Badge>
                  </div>
                  <div className="min-w-0">
                    <div className="break-words font-semibold">{student.student_name}</div>
                    <div className="text-xs text-muted-foreground">{student.registration_number}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 items-center gap-2 text-sm sm:flex sm:gap-4">
                  <div className="text-right">
                    <div className="text-muted-foreground">Wadarta</div>
                    <div className="font-bold text-primary">{student.totalMarks.toFixed(1)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">Celceliska</div>
                    <div className="font-bold text-primary">{student.average.toFixed(1)}</div>
                  </div>
                  {showGrade && getGrade(student.average) && (
                    <Badge className={`${getGrade(student.average)?.color ?? ''} text-white justify-self-end`}>
                      {getGrade(student.average)!.grade}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Subject Results Table */}
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Mawduc</TableHead>
                    <TableHead className="text-center">Term1</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {student.subjects.map((result) => {
                    const groupKey = `${result.student_id}-${result.subject_id}-${result.academic_year}`;
                    return (
                      <TableRow key={groupKey} className={selectedIds.has(groupKey) ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(groupKey)}
                            onCheckedChange={() => onToggleSelect(groupKey)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{result.subject_name}</TableCell>
                        <TableCell className="text-center">
                          {result.term1 !== null ? (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <div className="flex items-center gap-1">
                                <span className="font-semibold">{result.term1}</span>
                                {showGrade && getGrade(result.term1) && (
                                  <Badge className={`${getGrade(result.term1)?.color ?? ''} text-white text-xs`}>
                                    {getGrade(result.term1)!.grade}
                                  </Badge>
                                )}
                              </div>
                              {result.term1 < failedThreshold && (
                                <Badge variant="destructive" className="text-xs animate-pulse">
                                  Failed
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Tirtir Natiijada</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Ma hubtaa inaad tirtireyso natiijada {result.student_name} - {result.subject_name}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Jooji</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDeleteGroup(result.result_ids)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Tirtir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ClassResultsSection;
