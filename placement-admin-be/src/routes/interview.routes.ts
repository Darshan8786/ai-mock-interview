import { Router } from "express";
import {
  getInterviews,
  getInterviewById,
  createInterview,
  updateInterview,
  updateInterviewScores,
  deleteInterview,
} from "../controllers/interview.controller";
import { validate } from "../middleware/validate.middleware";
import {
  createInterviewSchema,
  updateInterviewSchema,
  updateInterviewScoresSchema,
  interviewParamsSchema,
  interviewQuerySchema,
} from "../validators/interview.validator";

const router = Router();

router.get("/", validate(interviewQuerySchema), getInterviews);
router.get("/:id", validate(interviewParamsSchema), getInterviewById);
router.post("/", validate(createInterviewSchema), createInterview);
router.put("/:id", validate(updateInterviewSchema), updateInterview);
router.patch("/:id/scores", validate(updateInterviewScoresSchema), updateInterviewScores);
router.delete("/:id", validate(interviewParamsSchema), deleteInterview);

export default router;
