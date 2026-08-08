import { Router } from "express";
import { protect } from "../middleware/auth";
import { restrictTo } from "../middleware/restrictTo";
import {
  getDashboardStats,
} from "../controllers/admin/dashboardController";
import {
  getStudents,
  getStudent,
  updateStudent,
  deleteStudent,
  verifyStudent,
  rejectStudent,
  setPlacementStatus,
} from "../controllers/admin/studentsController";
import {
  getInterviews,
  getInterviewDetail,
  getInterviewStats,
} from "../controllers/admin/interviewsController";
import {
  getAptitudeResults,
  getAptitudeResultDetail,
  getAptitudeStats,
} from "../controllers/admin/aptitudeController";
import {
  getQuizAttempts,
  getQuizStats,
  getSubjects,
} from "../controllers/admin/quizController";
import {
  getProctoringLogs,
  getProctoringStats,
} from "../controllers/admin/proctoringController";
import {
  createNotification,
  getNotifications,
  deleteNotification,
} from "../controllers/admin/notificationsController";
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from "../controllers/admin/announcementsController";
import {
  getQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getAdminTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  getAdminTests,
  createAdminTest,
  updateAdminTest,
  deleteAdminTest,
} from "../controllers/admin/aptitudeBankController";

const router = Router();

// All admin routes require a logged-in admin
router.use(protect, restrictTo("admin"));

// Dashboard
router.get("/dashboard", getDashboardStats);

// Students
router.get("/students", getStudents);
router.get("/students/:id", getStudent);
router.patch("/students/:id", updateStudent);
router.delete("/students/:id", deleteStudent);
router.patch("/students/:id/verify", verifyStudent);
router.patch("/students/:id/reject", rejectStudent);
router.patch("/students/:id/placement-status", setPlacementStatus);

// Interviews
router.get("/interviews", getInterviews);
router.get("/interviews/stats", getInterviewStats);
router.get("/interviews/:id", getInterviewDetail);

// Aptitude
router.get("/aptitude", getAptitudeResults);
router.get("/aptitude/stats", getAptitudeStats);
router.get("/aptitude/:id", getAptitudeResultDetail);

// Aptitude Question Bank
router.get("/aptitude-questions", getQuestions);
router.post("/aptitude-questions", createQuestion);
router.get("/aptitude-questions/:id", getQuestion);
router.patch("/aptitude-questions/:id", updateQuestion);
router.delete("/aptitude-questions/:id", deleteQuestion);

// Aptitude Topics
router.get("/aptitude-topics", getAdminTopics);
router.post("/aptitude-topics", createTopic);
router.patch("/aptitude-topics/:id", updateTopic);
router.delete("/aptitude-topics/:id", deleteTopic);

// Aptitude Test Configs
router.get("/aptitude-tests", getAdminTests);
router.post("/aptitude-tests", createAdminTest);
router.patch("/aptitude-tests/:id", updateAdminTest);
router.delete("/aptitude-tests/:id", deleteAdminTest);

// Quiz
router.get("/quizzes/attempts", getQuizAttempts);
router.get("/quizzes/stats", getQuizStats);
router.get("/quizzes/subjects", getSubjects);

// Proctoring
router.get("/proctoring", getProctoringLogs);
router.get("/proctoring/stats", getProctoringStats);

// Notifications
router.get("/notifications", getNotifications);
router.post("/notifications", createNotification);
router.delete("/notifications/:id", deleteNotification);

// Announcements
router.get("/announcements", getAnnouncements);
router.post("/announcements", createAnnouncement);
router.patch("/announcements/:id", updateAnnouncement);
router.delete("/announcements/:id", deleteAnnouncement);

export default router;
