import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import { HomePage } from "./pages/HomePage";
import { Signup } from "./pages/Signup";
import { Signin } from "./pages/Signin";
import { Toaster } from "react-hot-toast";
import { QuizPage } from "./pages/QuizPage";
import { Report } from "./pages/Report";
import { ProtectedRoute } from "./pages/ProtectedRoute";
import { GenAI } from "./pages/GenAI";
import { CompanyAI } from "./pages/CompanyAI";
import { SubjectAI } from "./pages/SubjectAI";
import { ResumeAnalyzer } from "./pages/ResumeAnalyzer";
import { Dashboard } from "./pages/Dashboard";
import { InterviewSetup } from "./pages/InterviewSetup";
import { InterviewRoom } from "./pages/InterviewRoom";
import { InterviewResult } from "./pages/InterviewResult";
import { MockDashboard } from "./pages/MockDashboard";
import { AptitudeTest } from "./pages/AptitudeTest";
import { AptitudeResult } from "./pages/AptitudeResult";
import { ResumeBuilder } from "./pages/ResumeBuilder";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/signin" element={<Signin />} />
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
            <Route path="/aptitude" element={<AptitudeTest />} />
            <Route path="/aptitude/result" element={<AptitudeResult />} />
          </Route>
        </Routes>
      </Layout>
      <Toaster position="bottom-right" reverseOrder={false} />
    </BrowserRouter>
  )
}

export default App;
