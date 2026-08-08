import { Router } from "express";
import {
  getAptitudeTests,
  getAptitudeTestById,
  createAptitudeTest,
  updateAptitudeTest,
  deleteAptitudeTest,
  getAptitudeResults,
  getAptitudeResultById,
  deleteAptitudeResult,
} from "../controllers/aptitude.controller";
import { validate } from "../middleware/validate.middleware";
import {
  createAptitudeTestSchema,
  updateAptitudeTestSchema,
  aptitudeParamsSchema,
  aptitudeAttemptParamsSchema,
  aptitudeTestQuerySchema,
  aptitudeResultsQuerySchema,
} from "../validators/aptitude.validator";

const router = Router();

router.get("/", validate(aptitudeTestQuerySchema), getAptitudeTests);
router.post("/", validate(createAptitudeTestSchema), createAptitudeTest);

router.get("/:id", validate(aptitudeParamsSchema), getAptitudeTestById);
router.put("/:id", validate(updateAptitudeTestSchema), updateAptitudeTest);
router.delete("/:id", validate(aptitudeParamsSchema), deleteAptitudeTest);

router.get(
  "/:id/results",
  validate(aptitudeResultsQuerySchema),
  getAptitudeResults
);

router.get(
  "/results/:attemptId",
  validate(aptitudeAttemptParamsSchema),
  getAptitudeResultById
);
router.delete(
  "/results/:attemptId",
  validate(aptitudeAttemptParamsSchema),
  deleteAptitudeResult
);

export default router;
