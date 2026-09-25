/**
 * Creates (or updates) an admin account that manages ONE college's interviews.
 *
 *   npm run create:college-admin -- --college "ABC College" --name "Priya" --email priya@abc.edu --password "S3cret!pass"
 *
 * The college is created if it does not exist. If the email already belongs to an
 * account, that account is promoted to admin and linked to the college.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { College } from "../models/College";
import { User } from "../models/User";

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? String(process.argv[i + 1] || "").trim() : "";
}

(async () => {
  const collegeName = arg("college");
  const name = arg("name") || "College Admin";
  const email = arg("email").toLowerCase();
  const password = arg("password");
  if (!collegeName || !email || !password) {
    console.error('Usage: npm run create:college-admin -- --college "ABC College" --name "Name" --email a@b.edu --password "…"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI as string);
  const college: any = await College.findOneAndUpdate(
    { name: collegeName },
    { name: collegeName },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const existing: any = await User.findOne({ email });
  if (existing) {
    existing.role = "admin";
    existing.college = college._id;
    await existing.save();
    console.log(`✅ ${email} is now an admin of "${college.name}" (existing account, password unchanged)`);
  } else {
    await User.create({ name, email, password, role: "admin", college: college._id });
    console.log(`✅ Created admin ${email} for "${college.name}"`);
  }
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
