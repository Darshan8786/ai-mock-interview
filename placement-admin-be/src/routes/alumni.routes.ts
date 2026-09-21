import { Router } from "express";
import {
  getAlumni,
  getAlumniById,
  createAlumni,
  updateAlumni,
  deleteAlumni,
  getOpenAlumniOpenings,
} from "../controllers/alumni.controller";
import { validate } from "../middleware/validate.middleware";
import {
  createAlumniSchema,
  updateAlumniSchema,
  alumniParamsSchema,
  alumniQuerySchema,
} from "../validators/alumni.validator";

/** Admin CRUD. Open (no login), like the other admin resources in this service. */
const router = Router();

router.get("/", validate(alumniQuerySchema), getAlumni);
router.get("/:id", validate(alumniParamsSchema), getAlumniById);
router.post("/", validate(createAlumniSchema), createAlumni);
router.put("/:id", validate(updateAlumniSchema), updateAlumni);
router.delete("/:id", validate(alumniParamsSchema), deleteAlumni);

export default router;

/** Student-facing, read-only: currently open alumni job openings. */
export const publicAlumniOpeningsRouter = Router();
publicAlumniOpeningsRouter.get("/", getOpenAlumniOpenings);
