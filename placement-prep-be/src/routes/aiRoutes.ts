
import express from "express";
import { userMiddleware } from "../middleware/userMiddleware";
import { subjectController } from "../controllers/aiControllers/subjectController";
import { roleController } from "../controllers/aiControllers/roleController";
import { companyController } from "../controllers/aiControllers/companyController";
import {
  evaluateRoleAnswer,
  finalizeRoleInterview,
  voiceUploadMiddleware,
  evaluateCompanyAnswer,
  finalizeCompanyInterview,
  evaluateSubjectAnswer,
  finalizeSubjectInterview,
} from "../controllers/aiControllers/voiceEvaluationController";

const router = express.Router();

router.post("/subject", userMiddleware, subjectController);
router.post("/role", userMiddleware, roleController);
router.post("/company", userMiddleware, companyController);

// Voice-based role interview
router.post("/role/answer", userMiddleware, voiceUploadMiddleware, evaluateRoleAnswer);
router.post("/role/finish", userMiddleware, finalizeRoleInterview);

// Voice-based company interview
router.post("/company/answer", userMiddleware, voiceUploadMiddleware, evaluateCompanyAnswer);
router.post("/company/finish", userMiddleware, finalizeCompanyInterview);

// Voice-based subject interview
router.post("/subject/answer", userMiddleware, voiceUploadMiddleware, evaluateSubjectAnswer);
router.post("/subject/finish", userMiddleware, finalizeSubjectInterview);

export default router;