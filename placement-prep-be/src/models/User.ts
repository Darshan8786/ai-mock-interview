import mongoose from "mongoose";
import bcrypt from "bcrypt";

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    techStack: { type: [String], default: [] },
    link: { type: String, default: "" },
  },
  { _id: false }
);

const certificationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    issuer: { type: String, default: "" },
    year: { type: String, default: "" },
    link: { type: String, default: "" },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // ── Core auth ────────────────────────────────────────
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    // ── Student profile (as entered on the Profile page) ─
    usn: { type: String, trim: true, uppercase: true, default: "" },
    registerNumber: { type: String, trim: true, default: "" },
    collegeEmail: { type: String, trim: true, lowercase: true, default: "" },
    personalEmail: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    department: { type: String, trim: true, default: "" },
    year: { type: String, trim: true, default: "" },
    semester: { type: String, trim: true, default: "" },
    section: { type: String, trim: true, default: "" },
    cgpa: { type: Number, min: 0, max: 10, default: null },
    skills: { type: [String], default: [] },
    certifications: { type: [certificationSchema], default: [] },
    projects: { type: [projectSchema], default: [] },
    resumeUrl: { type: String, default: "" },
    resumeFileName: { type: String, default: "" },
    profilePhoto: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    github: { type: String, default: "" },
    portfolio: { type: String, default: "" },
    address: { type: String, default: "" },
    dateOfBirth: { type: String, default: "" },

    // ── Admin-facing status fields ───────────────────────
    placementStatus: {
      type: String,
      enum: ["not_applied", "applied", "shortlisted", "selected", "not_selected", "placed"],
      default: "not_applied",
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// Index for admin search/filter performance
userSchema.index({ role: 1, department: 1, year: 1, semester: 1 });
userSchema.index({ usn: 1 });
userSchema.index({ name: "text", email: "text", usn: "text" });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model("User", userSchema);
