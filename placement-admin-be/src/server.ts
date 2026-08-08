import app from "./app";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { seedAdmin } from "./seed/seedAdmin";

const start = async (): Promise<void> => {
  try {
    await connectDB();
    await seedAdmin();

    const server = app.listen(env.PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`🚀 Admin API running at http://localhost:${env.PORT}`);
      // eslint-disable-next-line no-console
      console.log(`📚 Swagger docs at http://localhost:${env.PORT}${env.SWAGGER_UI}`);
    });

    const shutdown = async (signal: string): Promise<void> => {
      // eslint-disable-next-line no-console
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close();
      process.exit(0);
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

void start();
