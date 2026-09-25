import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import { Signup } from "./pages/Signup";
import { Signin } from "./pages/Signin";
import { Toaster } from "react-hot-toast";
import { Report } from "./pages/Report";
import { ProtectedRoute } from "./pages/ProtectedRoute";
import { AdminRoute } from "./pages/AdminRoute";
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
import { TechQuizSetup } from "./pages/TechQuizSetup";
import { TechQuizSession } from "./pages/TechQuizSession";
import { TechQuizResult } from "./pages/TechQuizResult";
import { Profile } from "./pages/Profile";
import { Jobs } from "./pages/Jobs";
import { JobDetails } from "./pages/JobDetails";
import { MyApplications } from "./pages/MyApplications";
import { ResumeBuilder } from "./pages/ResumeBuilder";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { StudentManagement } from "./pages/admin/StudentManagement";
import { ResumeManagement } from "./pages/admin/ResumeManagement";
import { InterviewManagement } from "./pages/admin/InterviewManagement";
import { AptitudeManagement } from "./pages/admin/AptitudeManagement";
import { JobManagement } from "./pages/admin/JobManagement";
import { JobForm } from "./pages/admin/JobForm";
import { JobApplications } from "./pages/admin/JobApplications";
import { JobEligibility } from "./pages/admin/JobEligibility";
import { ReportsAnalytics } from "./pages/admin/ReportsAnalytics";
import { AlumniManagement } from "./pages/admin/AlumniManagement";
import { CollegeInterviewForm } from "./pages/admin/CollegeInterviewForm";
import { CollegeInterviewDetails } from "./pages/admin/CollegeInterviewDetails";
import { CollegeInterviewQuestions } from "./pages/admin/CollegeInterviewQuestions";
import { AlumniForm } from "./pages/admin/AlumniForm";
import { AlumniDetails } from "./pages/admin/AlumniDetails";
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
            <Route path="/personalizedreport" element={<Report />} />
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
            <Route path="/tech-practice" element={<TechQuizSetup />} />
            <Route path="/tech-practice/quiz" element={<TechQuizSession />} />
            <Route path="/tech-practice/result" element={<TechQuizResult />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetails />} />
            <Route path="/my-applications" element={<MyApplications />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="students" element={<StudentManagement />} />
              <Route path="resumes" element={<ResumeManagement />} />
              <Route path="interviews" element={<InterviewManagement />} />
              <Route path="college-interviews/new" element={<CollegeInterviewForm />} />
              <Route path="college-interviews/:id" element={<CollegeInterviewDetails />} />
              <Route path="college-interviews/:id/edit" element={<CollegeInterviewForm />} />
              <Route path="college-interviews/:id/questions" element={<CollegeInterviewQuestions />} />
              <Route path="aptitude" element={<AptitudeManagement />} />
              <Route path="jobs" element={<JobManagement />} />
              <Route path="jobs/create" element={<JobForm />} />
              <Route path="jobs/:id/edit" element={<JobForm />} />
              <Route path="jobs/:id/applications" element={<JobApplications />} />
              <Route path="jobs/:id/eligibility" element={<JobEligibility />} />
              <Route path="alumni" element={<AlumniManagement />} />
              <Route path="alumni/new" element={<AlumniForm />} />
              <Route path="alumni/:id" element={<AlumniDetails />} />
              <Route path="alumni/:id/edit" element={<AlumniForm />} />
              <Route path="reports" element={<ReportsAnalytics />} />
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
