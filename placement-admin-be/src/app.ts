import type { Application } from "express";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import { apiRateLimiter } from "./middleware/rateLimit.middleware";
import { notFound } from "./middleware/notFound.middleware";
import { errorHandler } from "./middleware/error.middleware";
import { requireAdmin } from "./middleware/auth.middleware";
import { UPLOADS_DIR } from "./middleware/upload.middleware";
import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import studentRoutes from "./routes/student.routes";
import companyRoutes from "./routes/company.routes";
import jobRoutes from "./routes/job.routes";
import applicationRoutes from "./routes/application.routes";
import interviewRoutes from "./routes/interview.routes";
import aptitudeRoutes from "./routes/aptitude.routes";
import alumniRoutes, { publicAlumniOpeningsRouter } from "./routes/alumni.routes";

const app: Application = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// Logging
if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use("/uploads", express.static(UPLOADS_DIR));

// Global rate limit
app.use("/api", apiRateLimiter);

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "Server is healthy", data: null });
});

// Swagger docs
app.use(env.SWAGGER_UI, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use("/api/admin", authRoutes);
// Every admin data resource requires an admin (this service's own login, or a MindPrep admin-panel token).
app.use("/api/admin/dashboard", requireAdmin, dashboardRoutes);
app.use("/api/admin/students", requireAdmin, studentRoutes);
app.use("/api/admin/companies", requireAdmin, companyRoutes);
app.use("/api/admin/jobs", requireAdmin, jobRoutes);
app.use("/api/admin/applications", requireAdmin, applicationRoutes);
app.use("/api/admin/interviews", requireAdmin, interviewRoutes);
app.use("/api/admin/aptitude-tests", requireAdmin, aptitudeRoutes);
app.use("/api/admin/alumni", requireAdmin, alumniRoutes);

// Public (student-facing) read-only endpoint
app.use("/api/alumni-openings", publicAlumniOpeningsRouter);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

export default app;
