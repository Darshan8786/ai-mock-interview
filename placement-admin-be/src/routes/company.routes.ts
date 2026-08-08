import { Router } from "express";
import {
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
} from "../controllers/company.controller";
import { validate } from "../middleware/validate.middleware";
import {
  createCompanySchema,
  updateCompanySchema,
  companyParamsSchema,
  companyQuerySchema,
} from "../validators/company.validator";

const router = Router();

router.get("/", validate(companyQuerySchema), getCompanies);
router.get("/:id", validate(companyParamsSchema), getCompanyById);
router.post("/", validate(createCompanySchema), createCompany);
router.put("/:id", validate(updateCompanySchema), updateCompany);
router.delete("/:id", validate(companyParamsSchema), deleteCompany);

export default router;
