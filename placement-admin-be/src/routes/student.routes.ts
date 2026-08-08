import { Router } from "express";
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
} from "../controllers/student.controller";
import { validate } from "../middleware/validate.middleware";
import {
  createStudentSchema,
  updateStudentSchema,
  studentIdParamsSchema,
  studentQuerySchema,
} from "../validators/student.validator";

const router = Router();

router.get("/", validate(studentQuerySchema), getStudents);
router.get("/:id", validate(studentIdParamsSchema), getStudentById);
router.post("/", validate(createStudentSchema), createStudent);
router.put("/:id", validate(updateStudentSchema), updateStudent);
router.delete("/:id", validate(studentIdParamsSchema), deleteStudent);

export default router;
