import mongoose from "mongoose";

/**
 * A college (institution). Admins and students are linked to one by id; every
 * college-created interview belongs to exactly one college, and authorisation is
 * always derived from the authenticated user's college — never from the client.
 */
const collegeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 120 },
  },
  { timestamps: true }
);

export const College = mongoose.models.College || mongoose.model("College", collegeSchema);
