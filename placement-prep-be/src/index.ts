import 'dotenv/config'; 
import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { seedAdmin } from "./seed/seedAdmin.js";
import routes from "./routes/index.js";
import { globalErrorHandler } from "./middleware/error.js";
import { AppError } from "./utils/AppError.js";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "MindPrep AI Backend is Running 🚀",
    version: "1.0.0",
  });
});

app.use("/api/v1", routes);

app.all("*", (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

const startServer = async () => {
  try {
    await connectDB();
    await seedAdmin();

    const preferredPort = Number(process.env.PORT || env.PORT || 5000);
    const maxPortAttempts = 20;

    const tryListen = (port: number, attempt = 1) => {
      const server = app.listen(port, () => {
        console.log(`🚀 Server listening on port: ${port} mode: ${env.NODE_ENV}`);
      });

      server.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          if (attempt >= maxPortAttempts) {
            console.error(`No available port found after ${maxPortAttempts} attempts.`);
            process.exit(1);
            return;
          }

          const nextPort = port + 1;
          console.warn(`Port ${port} is busy, trying ${nextPort}...`);
          if (server.listening) {
            server.close(() => tryListen(nextPort, attempt + 1));
          } else {
            tryListen(nextPort, attempt + 1);
          }
        } else {
          console.error("Server error:", error);
          if (server.listening) {
            server.close(() => process.exit(1));
          } else {
            process.exit(1);
          }
        }
      });
    };

    process.on("unhandledRejection", (err: Error) => {
      console.log("UNHANDLED REJECTION! 💥 Shutting down...");
      process.exit(1);
    });

    tryListen(preferredPort);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
