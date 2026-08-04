import express from "express";
import { userMiddleware } from "../middleware/userMiddleware";
import { getPersonalizedReport, getSubjectAttempts } from "../controllers/reportController";
import { getLearningResources, getResourcesForSubject } from "../controllers/resourceController";

const router = express.Router();

router.get("/personalized", userMiddleware, getPersonalizedReport);
router.get("/subject-attempts", userMiddleware, getSubjectAttempts);
router.get("/learning-resources", userMiddleware, getLearningResources);
router.get("/resources/:subject", userMiddleware, getResourcesForSubject);

export default router;



