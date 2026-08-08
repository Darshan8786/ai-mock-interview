import { connectDB, disconnectDB } from "../config/db";
import { env } from "../config/env";
import { Admin } from "../models/Admin.model";
import { hashPassword } from "../services/password.service";

/**
 * Creates (or promotes) the default admin account. Runs automatically
 * on server boot and can be re-run via `npm run seed`.
 */
export async function seedAdmin(): Promise<void> {
  try {
    const existing = await Admin.findOne({ email: env.ADMIN_EMAIL });
    if (existing) {
      if (existing.isActive) {
        // eslint-disable-next-line no-console
        console.log(`✅ Admin already exists: ${env.ADMIN_EMAIL}`);
        return;
      }
      existing.isActive = true;
      await existing.save();
      // eslint-disable-next-line no-console
      console.log(`✅ Reactivated admin: ${env.ADMIN_EMAIL}`);
      return;
    }

    const hashed = await hashPassword(env.ADMIN_PASSWORD);
    await Admin.create({
      name: env.ADMIN_NAME,
      email: env.ADMIN_EMAIL,
      password: hashed,
      phone: env.ADMIN_PHONE,
      role: "admin",
      isActive: true,
    });
    // eslint-disable-next-line no-console
    console.log(`✅ Default admin created: ${env.ADMIN_EMAIL}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("❌ Failed to seed admin:", error);
    process.exitCode = 1;
  }
}

// Only run directly when invoked as a script
const isDirectRun =
  process.argv[1] && process.argv[1].includes("seedAdmin");

if (isDirectRun) {
  (async () => {
    await connectDB();
    await seedAdmin();
    await disconnectDB();
    process.exit(0);
  })();
}
