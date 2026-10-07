import { useEffect, useState, forwardRef } from 'react';
import { CalendarCheck, Check, X, Clock, Users, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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

interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: string;
}

const Attendance = forwardRef<HTMLDivElement>((_, ref) => {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClass && selectedDate) {
      fetchStudentsAndAttendance();
    }
  }, [selectedClass, selectedDate]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('*').order('name');
    if (data) setClasses(data);
  };

  const fetchStudentsAndAttendance = async () => {
    setLoading(true);
    const [studentsRes, attendanceRes] = await Promise.all([
      supabase.from('students').select('id, full_name, registration_number, class_id').eq('class_id', selectedClass).order('full_name'),
      supabase.from('attendance').select('*').eq('class_id', selectedClass).eq('date', selectedDate),
    ]);

    if (studentsRes.data) setStudents(studentsRes.data);
    if (attendanceRes.data) {
      setAttendance(attendanceRes.data);
      const statusMap: Record<string, string> = {};
      attendanceRes.data.forEach((a) => {
        statusMap[a.student_id] = a.status;
      });
      setLocalStatus(statusMap);
    } else {
      setAttendance([]);
      setLocalStatus({});
    }
    setLoading(false);
  };

  const handleStatusChange = (studentId: string, status: string) => {
    setLocalStatus((prev) => ({ ...prev, [studentId]: status }));
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      // Delete existing records for this class and date
      await supabase.from('attendance').delete().eq('class_id', selectedClass).eq('date', selectedDate);

      // Insert new records
      const records = Object.entries(localStatus).map(([studentId, status]) => ({
        student_id: studentId,
        class_id: selectedClass,
        date: selectedDate,
        status,
      }));

      if (records.length > 0) {
        const { error } = await supabase.from('attendance').insert(records);
        if (error) throw error;
      }

      toast.success('Attendance saved successfully!');
      fetchStudentsAndAttendance();
    } catch (error: any) {
      toast.error('Error saving attendance: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(localStatus).filter((s) => s === 'present').length;
  const absentCount = Object.values(localStatus).filter((s) => s === 'absent').length;
  const lateCount = Object.values(localStatus).filter((s) => s === 'late').length;

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const className = classes.find(c => c.id === selectedClass)?.name || 'Unknown';
    const data = students.map((s, i) => ({
      '#': i + 1,
      'Name': s.full_name,
      'Reg. Number': s.registration_number,
      'Status': (localStatus[s.id] || 'Not marked').charAt(0).toUpperCase() + (localStatus[s.id] || 'Not marked').slice(1),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `Attendance_${className}_${selectedDate}.xlsx`);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-success/20 text-success border-success/30"><Check className="h-3 w-3 mr-1" />Present</Badge>;
      case 'absent':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><X className="h-3 w-3 mr-1" />Absent</Badge>;
      case 'late':
        return <Badge className="bg-warning/20 text-warning border-warning/30"><Clock className="h-3 w-3 mr-1" />Late</Badge>;
      default:
        return <Badge variant="outline">Not marked</Badge>;
    }
  };

  return (
    <AdminLayout ref={ref} title="Attendance" description="Track daily student attendance by class">
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Select Class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full sm:w-[200px]"
        />
      </div>

      {selectedClass && (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                <div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{students.length}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10"><Check className="h-5 w-5 text-success" /></div>
                <div><p className="text-xs text-muted-foreground">Present</p><p className="text-xl font-bold text-success">{presentCount}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><X className="h-5 w-5 text-destructive" /></div>
                <div><p className="text-xs text-muted-foreground">Absent</p><p className="text-xl font-bold text-destructive">{absentCount}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div>
                <div><p className="text-xs text-muted-foreground">Late</p><p className="text-xl font-bold text-warning">{lateCount}</p></div>
              </CardContent>
            </Card>
          </div>

          {/* Student Table */}
          <Card>
            <CardHeader className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                Student Attendance
              </CardTitle>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button variant="outline" onClick={exportToExcel} disabled={students.length === 0} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />Export
                </Button>
                <Button onClick={saveAttendance} disabled={saving || students.length === 0} className="w-full sm:w-auto">
                  {saving ? 'Saving...' : 'Save Attendance'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8"><div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" /></div>
              ) : students.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No students found in this class.</p>
              ) : (
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Reg. Number</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student, index) => (
                      <TableRow key={student.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{student.full_name}</TableCell>
                        <TableCell>{student.registration_number}</TableCell>
                        <TableCell>{statusBadge(localStatus[student.id] || '')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant={localStatus[student.id] === 'present' ? 'default' : 'outline'}
                              className="h-8 px-2"
                              onClick={() => handleStatusChange(student.id, 'present')}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={localStatus[student.id] === 'absent' ? 'destructive' : 'outline'}
                              className="h-8 px-2"
                              onClick={() => handleStatusChange(student.id, 'absent')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={localStatus[student.id] === 'late' ? 'secondary' : 'outline'}
                              className="h-8 px-2"
                              onClick={() => handleStatusChange(student.id, 'late')}
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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

Attendance.displayName = 'Attendance';
export default Attendance;
