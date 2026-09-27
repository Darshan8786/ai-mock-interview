import { Router } from "express";
import {
  startTechQuiz,
  submitTechQuizAnswer,
  finishTechQuiz,
  getTechQuizHistory,
  getTechnologies,
} from "../controllers/techQuizController";
import {
  getTechPersonalization,
  getTechProgress,
  startAdaptiveTech,
  getAdaptiveTechState,
  retryAdaptiveTech,
  answerAdaptiveTech,
  finishAdaptiveTech,
  getAdaptiveTechReport,
  reattemptAdaptiveTech,
} from "../controllers/techAdaptiveController";
import { protect } from "../middleware/auth";

const router = Router();

router.use(protect);

router.get("/technologies", getTechnologies);
router.post("/start", startTechQuiz);
router.post("/:attemptId/answer", submitTechQuizAnswer);
router.post("/:attemptId/finish", finishTechQuiz);
router.get("/history", getTechQuizHistory);

// Adaptive AI-generated practice (one question at a time; see techAdaptiveController.ts)
router.get("/progress", getTechProgress);
router.get("/personalization", getTechPersonalization);
router.post("/adaptive/start", startAdaptiveTech);
router.get("/adaptive/:attemptId/state", getAdaptiveTechState);
router.post("/adaptive/:attemptId/retry", retryAdaptiveTech);
router.post("/adaptive/:attemptId/answer", answerAdaptiveTech);
router.post("/adaptive/:attemptId/finish", finishAdaptiveTech);
router.get("/adaptive/:attemptId/report", getAdaptiveTechReport);
router.post("/adaptive/:attemptId/questions/:index/reattempt", reattemptAdaptiveTech);

export default router;
