import { User } from "../models/User.js";
import { College } from "../models/College.js";

// Creates a default admin account on first startup so the admin
// console is always reachable. Override credentials via env vars.
// The seeded admin manages this college (college interviews are scoped to it).
// Override with ADMIN_COLLEGE; create admins for other colleges with
// `npm run create:college-admin`.
async function ensureDefaultCollege() {
  const name = process.env.ADMIN_COLLEGE || "MindPrep Demo College";
  return College.findOneAndUpdate({ name }, { name }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

export async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@mindprep.ai";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminName = process.env.ADMIN_NAME || "Admin";

  try {
    const college = await ensureDefaultCollege();
    const existing = await User.findOne({ email: adminEmail });
    if (existing) {
      if (existing.role !== "admin") {
        existing.role = "admin";
        await existing.save();
        console.log(`👑 Promoted ${adminEmail} to admin`);
      }
      if (!existing.college) {
        existing.college = college._id;
        await existing.save();
        console.log(`🏫 Linked ${adminEmail} to college "${college.name}"`);
      }
      return;
    }

    await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: "admin",
      college: college._id,
    });
    console.log(`👑 Default admin created: ${adminEmail} / ${adminPassword}`);
  } catch (error) {
    console.error("Failed to seed admin:", error);
  }
}
