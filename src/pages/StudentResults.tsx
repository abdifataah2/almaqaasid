import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, BookOpen, Award, FileText, Download, LogOut, Calendar, Trophy } from 'lucide-react';
import schoolLogo from '@/assets/school-logo-new.png';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';

interface StudentData {
  id: string;
  full_name: string;
  registration_number: string;
  class_name: string | null;
}

interface ResultData {
  subject_name: string;
  term1: number | null;
  total: number | null;
  academic_year: string;
}

const StudentResults = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [results, setResults] = useState<ResultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [ranking, setRanking] = useState<{ rank: number | null; totalStudents: number }>({ rank: null, totalStudents: 0 });
  const resultsCardRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const token = sessionStorage.getItem('student_token');
    
    if (!token) {
      toast({
        title: "Access Denied",
        description: "Please login to view your results.",
        variant: "destructive",
      });
      navigate('/student/login');
      return;
    }

    fetchResults(token);
  }, [navigate, toast]);

  const fetchResults = async (token: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-auth?action=results`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        sessionStorage.removeItem('student_token');
        sessionStorage.removeItem('student_data');
        
        toast({
          title: "Session Expired",
          description: "Please login again to view your results.",
          variant: "destructive",
        });
        navigate('/student/login');
        return;
      }

      setStudent(result.student);
      const resultsArray = result.results || [];
      const subjectMap = new Map<string, ResultData>();
      
      let latestYear = '';
      resultsArray.forEach((r: any) => {
        const subjectName = r.subjects?.name || 'Unknown Subject';
        const year = r.academic_year || '2025-2026';
        
        if (!latestYear || year > latestYear) {
          latestYear = year;
        }
        
        const key = `${subjectName}-${year}`;
        if (!subjectMap.has(key)) {
          subjectMap.set(key, {
            subject_name: subjectName,
            term1: null,
            total: null,
            academic_year: year,
          });
        }
        const entry = subjectMap.get(key)!;
        if (r.term === 'Term 1') entry.term1 = r.marks;
      });
      
      // Calculate totals (Term 1 only)
      subjectMap.forEach((entry) => {
        if (entry.term1 !== null) {
          entry.total = entry.term1;
        }
      });
      
      setAcademicYear(latestYear || '2025-2026');
      setResults(Array.from(subjectMap.values()));
      
      // Set ranking if available
      if (result.ranking) {
        setRanking({
          rank: result.ranking.rank,
          totalStudents: result.ranking.totalStudents
        });
      }
    } catch (error) {
      console.error('Error fetching results:', error);
      toast({
        title: "Error",
        description: "Failed to load results. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('student_token');
    sessionStorage.removeItem('student_data');
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully.",
    });
    navigate('/');
  };

  const getGrade = (marks: number | null) => {
    if (marks === null) return null;
    if (marks >= 80) return { grade: 'A', color: 'bg-green-500 text-white', textColor: 'text-green-600' };
    if (marks >= 70) return { grade: 'B', color: 'bg-blue-500 text-white', textColor: 'text-blue-600' };
    if (marks >= 60) return { grade: 'C', color: 'bg-yellow-500 text-white', textColor: 'text-yellow-600' };
    if (marks >= 50) return { grade: 'D', color: 'bg-orange-500 text-white', textColor: 'text-orange-600' };
    return { grade: 'F', color: 'bg-red-500 text-white', textColor: 'text-red-600' };
  };

  // Check if class is Form 4 or Class 8 (for different failed threshold and grade display)
  const isForm4OrClass8 = () => {
    const className = student?.class_name?.toLowerCase() || '';
    return className.includes('form 4') || className.includes('form4') || 
           className.includes('class 8') || className.includes('class8');
  };

  // Check if class is Form 1, Form 2, or Form 3 (Term 2 label + grades)
  const isForm123 = () => {
    const className = student?.class_name?.toLowerCase() || '';
    return /form\s*[123]\b/.test(className);
  };

  // Term column label
  const getTermLabel = () => (isForm123() ? 'Term2' : 'Term1');

  // Get failed threshold based on class
  const getFailedThreshold = () => {
    return isForm4OrClass8() || isForm123() ? 50 : 25;
  };

  // Check if grades should be shown (Form 4, Class 8, and Form 1/2/3)
  const shouldShowGrade = () => {
    return isForm4OrClass8() || isForm123();
  };

  // Students whose results are withheld (unpaid fees)
  const BLOCKED_REG_NUMBERS = ['68'];
  const isBlocked = BLOCKED_REG_NUMBERS.includes(
    (student?.registration_number || '').trim()
  );

  const calculateTotal = () => {

    return results.reduce((sum, r) => {
      return sum + (r.total || 0);
    }, 0);
  };

  const calculateAverage = () => {
    if (results.length === 0) return 0;
    const total = calculateTotal();
    const average = total / results.length;
    return average.toFixed(1);
  };

  const getOverallGrade = () => {
    const avg = parseFloat(calculateAverage().toString());
    if (avg >= 80) return { grade: 'A', color: 'bg-green-500 text-white' };
    if (avg >= 70) return { grade: 'B', color: 'bg-blue-500 text-white' };
    if (avg >= 60) return { grade: 'C', color: 'bg-yellow-500 text-white' };
    if (avg >= 50) return { grade: 'D', color: 'bg-orange-500 text-white' };
    return { grade: 'F', color: 'bg-red-500 text-white' };
  };

  const handleDownload = async () => {
    if (isBlocked) {
      toast({
        title: "Natijadaadi waa la qariyey",
        description: "Fadlan iska bixi lacagaha kugu tagan. Mahadsanid",
        variant: "destructive",
      });
      return;
    }
    if (!student || results.length === 0) {
      toast({
        title: "No Results",
        description: "There are no results to download.",
        variant: "destructive",
      });
      return;
    }


    if (!resultsCardRef.current) return;

    setIsDownloading(true);
    
    try {
      // Wait for the download view to render
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(resultsCardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#1a1a2e',
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${student.full_name.replace(/\s+/g, '_')}_Results_${academicYear}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          toast({
            title: "Downloaded",
            description: "Your results have been saved to your gallery.",
          });
        }
      }, 'image/png', 1.0);
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Error",
        description: "Failed to download results. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return null;
  }

  return (
    <div className="min-h-screen print:bg-card" style={{ background: 'linear-gradient(135deg, hsl(230, 35%, 12%) 0%, hsl(240, 30%, 16%) 50%, hsl(220, 35%, 14%) 100%)' }}>
      {/* Header */}
      <header className="py-3 px-4 sm:px-6 border-b border-white/10 print:hidden">
        <div className="container mx-auto">
          {/* Top row: logo, school name, buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <img src={schoolLogo} alt="School Logo" className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-contain flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-extrabold tracking-wide truncate" style={{ color: 'hsl(45, 100%, 60%)' }}>Al-Maqaasid</h1>
                <p className="text-xs sm:text-sm font-medium" style={{ color: 'hsl(190, 90%, 55%)' }}>Primary and Secondary School</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm"
                className="border-white/20 text-white bg-white/5 hover:bg-white/10 hover:text-white px-2 sm:px-3"
                onClick={handleDownload}
                disabled={isDownloading}
              >
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{isDownloading ? 'Downloading...' : 'Download PNG'}</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="border-white/20 text-white bg-white/5 hover:bg-white/10 hover:text-white px-2 sm:px-3"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Print Header */}
      <div className="hidden print:block text-center py-6 border-b">
        <h1 className="text-2xl font-extrabold" style={{ color: 'hsl(45, 100%, 60%)' }}>Al-Maqaasid</h1>
        <p className="text-sm font-medium" style={{ color: 'hsl(190, 90%, 55%)' }}>Primary and Secondary School</p>
      </div>

      {/* Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Student Info Card */}
        <Card className="mb-8 shadow-2xl animate-slide-up border border-white/10 backdrop-blur" style={{ background: 'hsl(230, 30%, 14%)' }}>
          <CardHeader className="border-b border-white/10">
            <CardTitle className="flex items-center gap-2 text-white">
              <User className="h-5 w-5 text-purple-400" />
              Student Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-5 gap-4">
              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide">Full Name</p>
                  <p className="font-semibold text-white">{student.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide">Registration No.</p>
                  <p className="font-semibold text-white">{student.registration_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <BookOpen className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide">Class</p>
                  <p className="font-semibold text-white">{student.class_name || 'Not Assigned'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide">Academic Year</p>
                  <p className="font-semibold text-white">{academicYear}</p>
                </div>
              </div>
              {/* Class Ranking - Only show for top 10 */}
              {!isBlocked && ranking.rank !== null && ranking.rank <= 10 && (
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Trophy className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-xs text-white/50 uppercase tracking-wide">Kalinta Gashay</p>
                    <p className="font-bold text-white text-2xl">
                      {ranking.rank}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card className="shadow-2xl animate-slide-up border border-white/10 backdrop-blur" style={{ animationDelay: '0.1s', background: 'hsl(230, 30%, 14%)' }}>
          <CardHeader className="border-b border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-white">
                <Award className="h-5 w-5 text-purple-400" />
                Academic Results
              </CardTitle>
              {!isBlocked && results.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                    <span className="text-sm text-white/50">Total:</span>
                    <span className="font-bold text-white text-lg">{calculateTotal().toFixed(0)}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <span className="text-sm text-white/50">Average:</span>
                    <span className="font-bold text-purple-400 text-lg">{calculateAverage()}%</span>
                  </div>
                  {shouldShowGrade() && (
                    <Badge className={`${getOverallGrade().color} px-3 py-1 text-sm`}>
                      Grade: {getOverallGrade().grade}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isBlocked ? (
              <div className="text-center py-16 px-6">
                <div className="p-4 bg-white/5 rounded-full w-fit mx-auto mb-4">
                  <FileText className="h-12 w-12 text-white/30" />
                </div>
                <p className="text-lg font-semibold text-white">
                  Natijadaadi waa la qariyey fadlan iska bixi lacagaha kugu tagan mahadsanid
                </p>
              </div>
            ) : results.length === 0 ? (

              <div className="text-center py-16">
                <div className="p-4 bg-white/5 rounded-full w-fit mx-auto mb-4">
                  <FileText className="h-12 w-12 text-white/30" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  No Results Available
                </h3>
                <p className="text-white/50">
                  Results for this academic year have not been uploaded yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/5 hover:bg-white/5 border-white/10">
                      <TableHead className="font-bold text-white/80 py-4">Subject</TableHead>
                      <TableHead className="font-bold text-white/80 text-center py-4">{getTermLabel()}</TableHead>
                      <TableHead className="font-bold text-white/80 text-center py-4">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, index) => {
                      const failedThreshold = getFailedThreshold();
                      return (
                        <TableRow key={index} className="hover:bg-white/5 border-b border-white/10">
                          <TableCell className="font-medium py-4 text-white">{result.subject_name}</TableCell>
                          <TableCell className="text-center py-4">
                            {result.term1 !== null ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-bold text-lg text-white">{result.term1}</span>
                                {result.term1 < failedThreshold && (
                                  <Badge variant="destructive" className="text-xs animate-pulse">
                                    Failed
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-white/30">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-4">
                            {result.total !== null ? (
                              <span className="font-bold text-lg text-purple-400">{result.total}</span>
                            ) : (
                              <span className="text-white/30">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grading Scale - Only show for Form 4 and Class 8 */}
        {shouldShowGrade() && (
          <Card className="mt-6 shadow-2xl animate-slide-up print:shadow-none border border-white/10 backdrop-blur" style={{ animationDelay: '0.2s', background: 'hsl(230, 30%, 14%)' }}>
            <CardHeader className="border-b border-white/10 py-3">
              <CardTitle className="text-sm text-white">Grading Scale</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <Badge className="bg-green-500 text-white">A</Badge>
                  <span className="text-muted-foreground">80-100</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge className="bg-blue-500 text-white">B</Badge>
                  <span className="text-muted-foreground">70-79</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge className="bg-yellow-500 text-white">C</Badge>
                  <span className="text-muted-foreground">60-69</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge className="bg-orange-500 text-white">D</Badge>
                  <span className="text-muted-foreground">50-59</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge className="bg-red-500 text-white">F</Badge>
                  <span className="text-muted-foreground">Below 50</span>
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Hidden Download View */}
        <div 
          ref={resultsCardRef}
          className={`${isDownloading ? 'fixed left-0 top-0 z-[-1]' : 'hidden'} p-6 w-[600px]`}
          style={{ fontFamily: 'system-ui, sans-serif', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #1a1a2e 100%)' }}
        >
          {/* School Header with Logo */}
          <div className="flex items-center justify-center gap-3 mb-4 pb-4" style={{ borderBottom: '2px solid rgba(139, 92, 246, 0.5)' }}>
            <img 
              src={schoolLogo} 
              alt="School Logo" 
              className="w-16 h-16 object-contain"
              crossOrigin="anonymous"
            />
            <div className="text-center">
              <h1 className="text-2xl font-extrabold" style={{ color: '#f5c842' }}>Al-Maqaasid</h1>
              <p className="text-sm font-medium" style={{ color: '#22d3ee' }}>Primary and Secondary School</p>
            </div>
          </div>

          {/* Student Info */}
          <div className={`grid ${ranking.rank !== null && ranking.rank <= 10 ? 'grid-cols-5' : 'grid-cols-4'} gap-3 mb-4 p-3 rounded-lg`} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Student Name</p>
              <p className="font-semibold text-white">{student?.full_name}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Registration No.</p>
              <p className="font-semibold text-white">{student?.registration_number}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Class</p>
              <p className="font-semibold text-white">{student?.class_name || 'Not Assigned'}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Academic Year</p>
              <p className="font-semibold text-white">{academicYear}</p>
            </div>
            {ranking.rank !== null && ranking.rank <= 10 && (
              <div className="text-center">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Kalinta Gashay</p>
                <p className="font-bold text-2xl" style={{ color: '#a78bfa' }}>{ranking.rank}</p>
              </div>
            )}
          </div>

          {/* Results Table */}
          <table className="w-full border-collapse mb-4">
            <thead>
              <tr style={{ background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }}>
                <th className="p-2 text-left text-sm text-white" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>Subject</th>
                <th className="p-2 text-center text-sm text-white" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>{getTermLabel()}</th>
                <th className="p-2 text-center text-sm text-white" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => (
                <tr key={index} style={{ background: index % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)' }}>
                  <td className="p-2 text-sm font-medium text-white" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>{result.subject_name}</td>
                  <td className="p-2 text-center text-sm font-bold text-white" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>{result.term1 ?? '-'}</td>
                  <td className="p-2 text-center text-sm font-bold" style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#a78bfa' }}>{result.total ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <div>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Total: </span>
              <span className="font-bold text-white">{calculateTotal().toFixed(0)}</span>
            </div>
            <div>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Average: </span>
              <span className="font-bold" style={{ color: '#a78bfa' }}>{calculateAverage()}%</span>
            </div>
            {shouldShowGrade() && (
              <div>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Grade: </span>
                <span className={`font-bold px-2 py-1 rounded text-white ${
                  getOverallGrade().grade === 'A' ? 'bg-green-500' :
                  getOverallGrade().grade === 'B' ? 'bg-blue-500' :
                  getOverallGrade().grade === 'C' ? 'bg-yellow-500' :
                  getOverallGrade().grade === 'D' ? 'bg-orange-500' : 'bg-red-500'
                }`}>{getOverallGrade().grade}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Generated on {new Date().toLocaleDateString()} | Al-Maqaasid School
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentResults;