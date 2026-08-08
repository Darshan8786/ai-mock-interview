import { User } from "../models/User.js";

// Creates a default admin account on first startup so the admin
// console is always reachable. Override credentials via env vars.
export async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@mindprep.ai";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminName = process.env.ADMIN_NAME || "Admin";

  try {
    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      if (existing.role !== "admin") {
        existing.role = "admin";
        await existing.save();
        console.log(`👑 Promoted ${adminEmail} to admin`);
      }
      return;
    }

    await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: "admin",
    });
    console.log(`👑 Default admin created: ${adminEmail} / ${adminPassword}`);
  } catch (error) {
    console.error("Failed to seed admin:", error);
  }
}
