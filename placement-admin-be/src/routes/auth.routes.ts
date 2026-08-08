import { Router } from "express";
import {
  login,
  refresh,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  bootstrapAdmin,
} from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { authRateLimiter } from "../middleware/rateLimit.middleware";
import {
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
  changePasswordSchema,
} from "../validators/auth.validator";

const router = Router();

// Public
router.post("/bootstrap-admin", bootstrapAdmin);
router.post("/login", authRateLimiter, validate(loginSchema), login);
router.post("/refresh", validate(refreshTokenSchema), refresh);

// Protected
router.post("/logout", protect, logout);
router.get("/me", protect, getProfile);
router.put("/me", protect, validate(updateProfileSchema), updateProfile);
router.put("/me/password", protect, validate(changePasswordSchema), changePassword);

export default router;
