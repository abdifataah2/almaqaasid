import { useEffect, useState, forwardRef } from 'react';
import { DollarSign, Check, X, Users, Plus, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import AdminLayout from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClassData {
  id: string;
  name: string;
}

interface StudentData {
  id: string;
  full_name: string;
  registration_number: string;
  class_id: string;
}

interface FinanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  amount: number;
  paid: boolean;
  payment_date: string | null;
  academic_year: string;
  term: string;
  description: string | null;
}

const Finance = forwardRef<HTMLDivElement>((_, ref) => {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [finance, setFinance] = useState<FinanceRecord[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('2024');
  const [selectedTerm, setSelectedTerm] = useState<string>('Term 1');
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feeAmount, setFeeAmount] = useState<string>('');
  const [feeDescription, setFeeDescription] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchData();
    }
  }, [selectedClass, selectedYear, selectedTerm]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').order('name');
    if (data) setClasses(data);
  };

  const fetchData = async () => {
    setLoading(true);
    const [studentsRes, financeRes] = await Promise.all([
      supabase.from('students').select('id, full_name, registration_number, class_id').eq('class_id', selectedClass).order('full_name'),
      supabase.from('finance').select('*').eq('class_id', selectedClass).eq('academic_year', selectedYear).eq('term', selectedTerm),
    ]);

    if (studentsRes.data) setStudents(studentsRes.data);
    if (financeRes.data) setFinance(financeRes.data);
    setLoading(false);
  };

  const assignFeeToAll = async () => {
    if (!feeAmount || isNaN(Number(feeAmount))) {
      toast.error('Please enter a valid amount');
      return;
    }
    setAssigning(true);
    try {
      const records = students.map((s) => ({
        student_id: s.id,
        class_id: selectedClass,
        amount: Number(feeAmount),
        paid: false,
        academic_year: selectedYear,
        term: selectedTerm,
        description: feeDescription || null,
      }));

      // Only add for students who don't already have a record
      const existingStudentIds = finance.map((f) => f.student_id);
      const newRecords = records.filter((r) => !existingStudentIds.includes(r.student_id));

      if (newRecords.length === 0) {
        toast.info('All students already have fee records for this term.');
        setAssigning(false);
        return;
      }

      const { error } = await supabase.from('finance').insert(newRecords);
      if (error) throw error;
      toast.success(`Fee assigned to ${newRecords.length} students!`);
      setDialogOpen(false);
      setFeeAmount('');
      setFeeDescription('');
      fetchData();
    } catch (error: any) {
      toast.error('Error: ' + error.message);
    } finally {
      setAssigning(false);
    }
  };

  const togglePaid = async (record: FinanceRecord) => {
    const { error } = await supabase
      .from('finance')
      .update({ paid: !record.paid, payment_date: !record.paid ? new Date().toISOString().split('T')[0] : null })
      .eq('id', record.id);

    if (error) {
      toast.error('Error updating payment status');
    } else {
      toast.success(record.paid ? 'Marked as unpaid' : 'Marked as paid');
      fetchData();
    }
  };

  const getStudentFinance = (studentId: string) => finance.find((f) => f.student_id === studentId);

  const paidCount = finance.filter((f) => f.paid).length;
  const unpaidCount = finance.filter((f) => !f.paid).length;
  const totalCollected = finance.filter((f) => f.paid).reduce((sum, f) => sum + Number(f.amount), 0);
  const totalPending = finance.filter((f) => !f.paid).reduce((sum, f) => sum + Number(f.amount), 0);

  const exportToExcel = () => {
    const className = classes.find(c => c.id === selectedClass)?.name || 'Unknown';
    const data = students.map((s, i) => {
      const record = getStudentFinance(s.id);
      return {
        '#': i + 1,
        'Name': s.full_name,
        'Reg. Number': s.registration_number,
        'Amount': record ? Number(record.amount) : 0,
        'Status': record ? (record.paid ? 'Paid' : 'Unpaid') : 'No fee assigned',
        'Payment Date': record?.payment_date || '-',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Finance');
    XLSX.writeFile(wb, `Finance_${className}_${selectedYear}_${selectedTerm}.xlsx`);
  };

  return (
    <AdminLayout ref={ref} title="Finance" description="Track student fee payments by class">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedTerm} onValueChange={setSelectedTerm}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Term 1">Term 1</SelectItem>
            <SelectItem value="Term 2">Term 2</SelectItem>
            <SelectItem value="Term 3">Term 3</SelectItem>
          </SelectContent>
        </Select>

        {selectedClass && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Assign Fee</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Fee to All Students</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Amount</Label>
                  <Input type="number" placeholder="Enter fee amount" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Input placeholder="e.g. Tuition Fee" value={feeDescription} onChange={(e) => setFeeDescription(e.target.value)} />
                </div>
                <Button onClick={assignFeeToAll} disabled={assigning} className="w-full">
                  {assigning ? 'Assigning...' : 'Assign to All Students'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {selectedClass && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                <div><p className="text-xs text-muted-foreground">Total Students</p><p className="text-xl font-bold">{students.length}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10"><Check className="h-5 w-5 text-success" /></div>
                <div><p className="text-xs text-muted-foreground">Paid</p><p className="text-xl font-bold text-success">{paidCount}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><X className="h-5 w-5 text-destructive" /></div>
                <div><p className="text-xs text-muted-foreground">Unpaid</p><p className="text-xl font-bold text-destructive">{unpaidCount}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10"><DollarSign className="h-5 w-5 text-info" /></div>
                <div><p className="text-xs text-muted-foreground">Collected</p><p className="text-xl font-bold">${totalCollected.toLocaleString()}</p></div>
              </CardContent>
            </Card>
          </div>

          {/* Student Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Student Fees
              </CardTitle>
              <Button variant="outline" onClick={exportToExcel} disabled={students.length === 0}>
                <Download className="h-4 w-4 mr-2" />Export
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8"><div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" /></div>
              ) : students.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No students found in this class.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Reg. Number</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student, index) => {
                      const record = getStudentFinance(student.id);
                      return (
                        <TableRow key={student.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium">{student.full_name}</TableCell>
                          <TableCell>{student.registration_number}</TableCell>
                          <TableCell>{record ? `$${Number(record.amount).toLocaleString()}` : '-'}</TableCell>
                          <TableCell>
                            {record ? (
                              record.paid ? (
                                <Badge className="bg-success/20 text-success border-success/30"><Check className="h-3 w-3 mr-1" />Paid</Badge>
                              ) : (
                                <Badge className="bg-destructive/20 text-destructive border-destructive/30"><X className="h-3 w-3 mr-1" />Unpaid</Badge>
                              )
                            ) : (
                              <Badge variant="outline">No fee assigned</Badge>
                            )}
                          </TableCell>
                          <TableCell>{record?.payment_date || '-'}</TableCell>
                          <TableCell>
                            {record && (
                              <Button size="sm" variant={record.paid ? 'outline' : 'default'} onClick={() => togglePaid(record)}>
                                {record.paid ? 'Mark Unpaid' : 'Mark Paid'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AdminLayout>
  );
});

Finance.displayName = 'Finance';
export default Finance;
