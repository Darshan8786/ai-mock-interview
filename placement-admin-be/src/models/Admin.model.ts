import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IAdmin extends Document {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: "admin";
  avatar?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<IAdmin>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true, select: false, minlength: 6 },
    phone: { type: String, trim: true },
    role: { type: String, enum: ["admin"], default: "admin" },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    refreshToken: { type: String, select: false },
  },
  { timestamps: true }
);

// Hide sensitive fields from JSON output
adminSchema.set("toJSON", {
  transform: (_doc: unknown, ret: { password?: string; refreshToken?: string; __v?: number }) => {
    delete ret.password;
    delete ret.refreshToken;
    delete ret.__v;
    return ret;
  },
});

export const Admin: Model<IAdmin> = mongoose.model<IAdmin>("Admin", adminSchema);
