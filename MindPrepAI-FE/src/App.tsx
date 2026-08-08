import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import { HomePage } from "./pages/HomePage";
import { Signup } from "./pages/Signup";
import { Signin } from "./pages/Signin";
import { Toaster } from "react-hot-toast";
import { QuizPage } from "./pages/QuizPage";
import { Report } from "./pages/Report";
import { ProtectedRoute } from "./pages/ProtectedRoute";
import { AdminRoute } from "./pages/AdminRoute";
import { GenAI } from "./pages/GenAI";
import { CompanyAI } from "./pages/CompanyAI";
import { SubjectAI } from "./pages/SubjectAI";
import { ResumeAnalyzer } from "./pages/ResumeAnalyzer";
import { Dashboard } from "./pages/Dashboard";
import { InterviewSetup } from "./pages/InterviewSetup";
import { InterviewRoom } from "./pages/InterviewRoom";
import { InterviewResult } from "./pages/InterviewResult";
import { MockDashboard } from "./pages/MockDashboard";
import { AptitudeDashboard } from "./pages/AptitudeDashboard";
import { AptitudeTest } from "./pages/AptitudeTest";
import { AptitudeSession } from "./pages/AptitudeSession";
import { AptitudeResult } from "./pages/AptitudeResult";
import { AptitudeProgress } from "./pages/AptitudeProgress";
import { AptitudeHistory } from "./pages/AptitudeHistory";
import { Profile } from "./pages/Profile";
import { ResumeBuilder } from "./pages/ResumeBuilder";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { StudentManagement } from "./pages/admin/StudentManagement";
import { ResumeManagement } from "./pages/admin/ResumeManagement";
import { InterviewManagement } from "./pages/admin/InterviewManagement";
import { QuizManagement } from "./pages/admin/QuizManagement";
import { AptitudeManagement } from "./pages/admin/AptitudeManagement";
import { JobManagement } from "./pages/admin/JobManagement";
import { ReportsAnalytics } from "./pages/admin/ReportsAnalytics";
import { ProctoringLogs } from "./pages/admin/ProctoringLogs";
import { Announcements } from "./pages/admin/Announcements";
import { Settings } from "./pages/admin/Settings";
import { AdminSignin } from "./pages/admin/AdminSignin";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/signin" element={<Signin />} />
          <Route path="/admin/signin" element={<AdminSignin />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/quizpage" element={<HomePage />} />
            <Route path="/:subject" element={<QuizPage />} />
            <Route path="/personalizedreport" element={<Report />} />
            <Route path="/genai" element={<GenAI />} />
            <Route path="/company-ai" element={<CompanyAI />} />
            <Route path="/subject-ai" element={<SubjectAI />} />
            <Route path="/resume-analyzer" element={<ResumeAnalyzer />} />
            <Route path="/resume-builder" element={<ResumeBuilder />} />
            <Route path="/mock-interview/setup" element={<InterviewSetup />} />
            <Route path="/mock-interview/room" element={<InterviewRoom />} />
            <Route path="/mock-interview/result/:id" element={<InterviewResult />} />
            <Route path="/mock-interview/dashboard" element={<MockDashboard />} />
            <Route path="/aptitude" element={<AptitudeDashboard />} />
            <Route path="/aptitude/test/:testId" element={<AptitudeTest />} />
            <Route path="/aptitude/practice" element={<AptitudeTest />} />
            <Route path="/aptitude/session/:attemptId" element={<AptitudeSession />} />
            <Route path="/aptitude/progress" element={<AptitudeProgress />} />
            <Route path="/aptitude/history" element={<AptitudeHistory />} />
            <Route path="/aptitude/result" element={<AptitudeResult />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="students" element={<StudentManagement />} />
              <Route path="resumes" element={<ResumeManagement />} />
              <Route path="interviews" element={<InterviewManagement />} />
              <Route path="quizzes" element={<QuizManagement />} />
              <Route path="aptitude" element={<AptitudeManagement />} />
              <Route path="jobs" element={<JobManagement />} />
              <Route path="reports" element={<ReportsAnalytics />} />
              <Route path="proctoring" element={<ProctoringLogs />} />
              <Route path="announcements" element={<Announcements />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </Layout>
      <Toaster position="bottom-right" reverseOrder={false} />
    </BrowserRouter>
  )
}

export default App;
