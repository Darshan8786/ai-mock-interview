import { Router } from "express";
import {
  saveAptitudeResult,
  getMyAptitudeResults,
  getMyAptitudeStats,
  getAptitudeTopics,
  getAptitudeCompanies,
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
import {
  getAdaptivePersonalization,
  startAdaptiveAptitude,
  getAdaptiveAptitudeState,
  retryAdaptiveAptitude,
  answerAdaptiveAptitude,
  finishAdaptiveAptitude,
  getAdaptiveAptitudeReport,
  reattemptAdaptiveAptitude,
} from "../controllers/aptitudeAdaptiveController";
import { protect } from "../middleware/auth";

const router = Router();

router.use(protect);

// Results / stats
router.post("/save-result", saveAptitudeResult);
router.get("/my-results", getMyAptitudeResults);
router.get("/my-stats", getMyAptitudeStats);

// Topics & test configs
router.get("/topics", getAptitudeTopics);
router.get("/companies", getAptitudeCompanies);
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

// Adaptive AI-generated practice (one question at a time; see aptitudeAdaptiveController.ts)
router.get("/adaptive/personalization", getAdaptivePersonalization);
router.post("/adaptive/start", startAdaptiveAptitude);
router.get("/adaptive/:attemptId/state", getAdaptiveAptitudeState);
router.post("/adaptive/:attemptId/retry", retryAdaptiveAptitude);
router.post("/adaptive/:attemptId/answer", answerAdaptiveAptitude);
router.post("/adaptive/:attemptId/finish", finishAdaptiveAptitude);
router.get("/adaptive/:attemptId/report", getAdaptiveAptitudeReport);
router.post("/adaptive/:attemptId/items/:itemIndex/reattempt", reattemptAdaptiveAptitude);

// Public question bank (no answers)
router.get("/questions", getAptitudeQuestions);

export default router;
