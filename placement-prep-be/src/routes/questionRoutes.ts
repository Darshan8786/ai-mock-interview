import { Router } from "express";
import { createAIQuestion, searchQuestions } from "../controllers/questionController";
import { protect } from "../middleware/auth";

const router = Router();

// Protect all routes
router.use(protect);

router.post("/generate", createAIQuestion);
router.post("/search", searchQuestions);

export default router;
