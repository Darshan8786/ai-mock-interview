import { Router } from "express";
import { protect } from "../middleware/auth";
import {
  createInterview,
  getInterview,
  getInterviewState,
  regenerateQuestions,
  submitAnswer,
  skipQuestion,
  reportCheating,
  terminateInterview,
  getReport,
  getDashboard,
  getQuestionHistory,
  reattemptQuestion,
  getProgress,
  getPersonalization,
} from "../controllers/mockInterviewController";
import { listMyCollegeInterviews, getMyCollegeInterview } from "../controllers/collegeInterviewStudentController";

const router = Router();

router.use(protect);

router.post("/create", createInterview);
// Must come before "/:id" so "college-interviews" is not read as an interview id.
router.get("/college-interviews", listMyCollegeInterviews);
router.get("/college-interviews/:id", getMyCollegeInterview);
router.get("/dashboard", getDashboard);
// Cross-interview views - like "dashboard", these must come before "/:id".
router.get("/progress", getProgress);
router.get("/personalization", getPersonalization);
router.get("/:id/state", getInterviewState);
router.post("/:id/regenerate-questions", regenerateQuestions);
router.get("/:id", getInterview);
router.post("/:id/answer", submitAnswer);
router.post("/:id/skip", skipQuestion);
router.post("/:id/cheating", reportCheating);
router.post("/:id/terminate", terminateInterview);
router.get("/:id/report", getReport);
router.get("/:id/question/:questionId/history", getQuestionHistory);
router.post("/:id/question/:questionId/reattempt", reattemptQuestion);

export default router;
