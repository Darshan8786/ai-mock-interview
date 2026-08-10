import { Router } from "express";
import { userMiddleware } from "../middleware/userMiddleware";
import {
  getQuizQuestions,
  validateQuizAnswers,
  recordQuizAttempt,
} from "../controllers/quizController";

const router = Router();

router.get("/:subject", userMiddleware, getQuizQuestions);
router.post("/validate", userMiddleware, validateQuizAnswers);
router.post("/attempt", userMiddleware, recordQuizAttempt);

export default router;
