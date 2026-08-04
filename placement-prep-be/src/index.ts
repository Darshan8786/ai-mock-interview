import 'dotenv/config'; 
import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
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
    const port = Number(process.env.PORT || env.PORT || 5000);
    const server = app.listen(port, () => {
      console.log(`🚀 Server listening on port: ${port} mode: ${env.NODE_ENV}`);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.warn(`Port ${port} is busy, trying ${port + 1}...`);
        server.close();
        app.listen(port + 1, () => {
          console.log(`🚀 Server listening on port: ${port + 1} mode: ${env.NODE_ENV}`);
        });
      } else {
        throw error;
      }
    });

    process.on("unhandledRejection", (err: Error) => {
      console.log("UNHANDLED REJECTION! 💥 Shutting down...");
      server.close(() => process.exit(1));
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
