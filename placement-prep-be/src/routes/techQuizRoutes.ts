import { Router } from "express";
import {
  startTechQuiz,
  submitTechQuizAnswer,
  finishTechQuiz,
  getTechQuizHistory,
  getTechnologies,
} from "../controllers/techQuizController";
import { protect } from "../middleware/auth";

const router = Router();

router.use(protect);

router.get("/technologies", getTechnologies);
router.post("/start", startTechQuiz);
router.post("/:attemptId/answer", submitTechQuizAnswer);
router.post("/:attemptId/finish", finishTechQuiz);
router.get("/history", getTechQuizHistory);

export default router;
