import { Router } from "express";
import {
  saveAptitudeResult,
  getMyAptitudeResults,
  getMyAptitudeStats,
  getAptitudeTopics,
  getAptitudeTests,
  getAptitudeTest,
  getTestQuestions,
  submitTest,
  getPracticeQuestions,
  submitPractice,
  startAptitudeTest,
  getActiveAttempt,
  submitAptitudeTest,
  getAptitudeProgress,
  getAptitudeHistory,
  getAptitudeHistoryDetail,
  getAptitudeQuestions,
} from "../controllers/aptitudeController";
import { protect } from "../middleware/auth";

const router = Router();

router.use(protect);

// Results / stats
router.post("/save-result", saveAptitudeResult);
router.get("/my-results", getMyAptitudeResults);
router.get("/my-stats", getMyAptitudeStats);

// Topics & test configs
router.get("/topics", getAptitudeTopics);
router.get("/tests", getAptitudeTests);
router.get("/tests/:id", getAptitudeTest);
router.get("/tests/:id/questions", getTestQuestions);
router.post("/tests/:id/submit", submitTest);

// Practice mode
router.get("/practice", getPracticeQuestions);
router.post("/practice/submit", submitPractice);

// Unified session flow (start / active attempt / submit)
router.post("/test/start", startAptitudeTest);
router.get("/test/:attemptId", getActiveAttempt);
router.post("/test/:attemptId/submit", submitAptitudeTest);

// Progress & history
router.get("/progress", getAptitudeProgress);
router.get("/history", getAptitudeHistory);
router.get("/history/:attemptId", getAptitudeHistoryDetail);

// Public question bank (no answers)
router.get("/questions", getAptitudeQuestions);

export default router;
