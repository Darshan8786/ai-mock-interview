import { Router } from "express";
import {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
} from "../controllers/job.controller";
import { validate } from "../middleware/validate.middleware";
import {
  createJobSchema,
  updateJobSchema,
  jobParamsSchema,
  jobQuerySchema,
} from "../validators/job.validator";

const router = Router();

router.get("/", validate(jobQuerySchema), getJobs);
router.get("/:id", validate(jobParamsSchema), getJobById);
router.post("/", validate(createJobSchema), createJob);
router.put("/:id", validate(updateJobSchema), updateJob);
router.delete("/:id", validate(jobParamsSchema), deleteJob);

export default router;
