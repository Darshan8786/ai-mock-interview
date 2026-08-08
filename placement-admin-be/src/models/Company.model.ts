import mongoose, { Schema, type Document, type Model } from "mongoose";

export type CompanyStatus = "active" | "inactive" | "blacklisted";

export interface ICompany extends Document {
  companyName: string;
  hrName: string;
  email: string;
  phone?: string;
  location?: string;
  description?: string;
  logo?: string;
  website?: string;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    hrName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },
    description: { type: String, trim: true },
    logo: { type: String },
    website: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive", "blacklisted"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

companySchema.index({ companyName: "text", email: "text" });

export const Company: Model<ICompany> = mongoose.model<ICompany>(
  "Company",
  companySchema
);
