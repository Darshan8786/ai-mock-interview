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

export default router;
