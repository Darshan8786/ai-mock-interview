import { Router } from "express";
import { protect } from "../middleware/auth";
import { analyzeResume, uploadMiddleware, enhanceResumeContent, parseResumeToJSON, parseResumeFromText, autoFixResume, evaluateBuilderResume } from "../controllers/resumeController";

const router = Router();

router.use(protect);
router.post("/analyze", uploadMiddleware, analyzeResume);
router.post("/enhance", enhanceResumeContent);
router.post("/parse", uploadMiddleware, parseResumeToJSON);
router.post("/parse-text", parseResumeFromText);
router.post("/auto-fix", uploadMiddleware, autoFixResume);
router.post("/evaluate-builder", evaluateBuilderResume);

export default router;
