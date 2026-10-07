import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";

const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const StudentLogin = lazy(() => import("./pages/StudentLogin"));
const StudentResults = lazy(() => import("./pages/StudentResults"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Students = lazy(() => import("./pages/admin/Students"));
const Teachers = lazy(() => import("./pages/admin/Teachers"));
const Classes = lazy(() => import("./pages/admin/Classes"));
const Subjects = lazy(() => import("./pages/admin/Subjects"));
const Results = lazy(() => import("./pages/admin/Results"));
const Attendance = lazy(() => import("./pages/admin/Attendance"));
const Finance = lazy(() => import("./pages/admin/Finance"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const queryClient = new QueryClient();

const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/student/login" element={<StudentLogin />} />
              <Route path="/results" element={<StudentResults />} />
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/students" element={<Students />} />
              <Route path="/admin/teachers" element={<Teachers />} />
              <Route path="/admin/classes" element={<Classes />} />
              <Route path="/admin/subjects" element={<Subjects />} />
              <Route path="/admin/results" element={<Results />} />
              <Route path="/admin/attendance" element={<Attendance />} />
              <Route path="/admin/finance" element={<Finance />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
