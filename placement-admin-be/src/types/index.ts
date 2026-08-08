import type { Request } from "express";

// ── JWT ─────────────────────────────────────────────────
export interface JwtPayload {
  id: string;
  email: string;
  role: "admin";
  type: "access" | "refresh";
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ── Express request augmentation ────────────────────────
export interface AuthenticatedAdmin {
  id: string;
  email: string;
  role: "admin";
}

declare global {
  namespace Express {
    interface Request {
      admin?: AuthenticatedAdmin;
      file?: Express.Multer.File;
      files?:
        | { [fieldname: string]: Express.Multer.File[] }
        | Express.Multer.File[];
    }
  }
}

// ── Generic response helpers ────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
}

export function toObjectId(value: string): string {
  return value;
}

// Re-export for convenience in controllers
export type { Request };
