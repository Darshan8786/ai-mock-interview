import { Router } from "express";
import {
  getApplications,
  getApplicationById,
  createApplication,
  updateApplicationStatus,
  deleteApplication,
} from "../controllers/application.controller";
import { validate } from "../middleware/validate.middleware";
import {
  applicationParamsSchema,
  applicationQuerySchema,
  createApplicationSchema,
  updateApplicationStatusSchema,
} from "../validators/application.validator";

const router = Router();

router.get("/", validate(applicationQuerySchema), getApplications);
router.get("/:id", validate(applicationParamsSchema), getApplicationById);
router.post("/", validate(createApplicationSchema), createApplication);
router.patch("/:id/status", validate(updateApplicationStatusSchema), updateApplicationStatus);
router.delete("/:id", validate(applicationParamsSchema), deleteApplication);

export default router;
