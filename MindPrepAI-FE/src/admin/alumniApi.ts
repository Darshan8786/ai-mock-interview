// ─────────────────────────────────────────────────────────────
// Alumni API client
//
// Talks to placement-admin-be (default http://localhost:5001). The alumni
// endpoints are open (no login), like that service's other admin resources.
// ─────────────────────────────────────────────────────────────
import { ADMIN_API_URL } from "../config/config";

// ── Types ────────────────────────────────────────────────

export interface AlumniOpening {
  jobTitle: string;
  location: string;
  requiredSkills: string[];
  jobDescription: string;
  applicationLink: string;
  lastDateToApply: string;
}

export interface Alumni {
  _id: string;
  name: string;
  graduationYear: number;
  department: string;
  currentCompany: string;
  currentJobRole: string;
  email: string;
  linkedin?: string;
  hasOpening: boolean;
  opening?: AlumniOpening;
  createdAt: string;
  updatedAt: string;
}

/** Body sent when creating/updating an alumnus. `opening` is only sent when hasOpening is true. */
export interface AlumniInput {
  name: string;
  graduationYear: number;
  department: string;
  currentCompany: string;
  currentJobRole: string;
  email: string;
  linkedin?: string;
  hasOpening: boolean;
  opening?: AlumniOpening;
}

export interface PublicAlumniOpening {
  id: string;
  alumniName: string;
  graduationYear: number;
  currentCompany: string;
  currentJobRole: string;
  jobTitle: string;
  location: string;
  requiredSkills: string[];
  jobDescription: string;
  applicationLink: string;
  lastDateToApply: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ── Requests ─────────────────────────────────────────────

interface Envelope<T> {
  data: T;
  pagination?: Pagination;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<Envelope<T>> {
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    });
  } catch {
    throw new Error(`Can't reach the alumni service at ${ADMIN_API_URL}. Make sure placement-admin-be is running.`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || `Request failed: ${res.status}`);
  return body as Envelope<T>;
}

// ── Admin endpoints ──────────────────────────────────────

export const alumniApi = {
  async list(params: { search?: string; hasOpening?: boolean; page?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (params.search?.trim()) q.set("search", params.search.trim());
    if (params.hasOpening !== undefined) q.set("hasOpening", String(params.hasOpening));
    q.set("page", String(params.page ?? 1));
    q.set("limit", String(params.limit ?? 10));
    const body = await request<Alumni[]>(`/api/admin/alumni?${q.toString()}`);
    return { items: body.data, pagination: body.pagination! };
  },

  async get(id: string): Promise<Alumni> {
    return (await request<Alumni>(`/api/admin/alumni/${id}`)).data;
  },

  async create(input: AlumniInput): Promise<Alumni> {
    return (await request<Alumni>("/api/admin/alumni", { method: "POST", body: JSON.stringify(input) })).data;
  },

  async update(id: string, input: Partial<AlumniInput>): Promise<Alumni> {
    return (await request<Alumni>(`/api/admin/alumni/${id}`, { method: "PUT", body: JSON.stringify(input) })).data;
  },

  async remove(id: string): Promise<void> {
    await request<null>(`/api/admin/alumni/${id}`, { method: "DELETE" });
  },
};

// ── Student-facing ───────────────────────────────────────

export async function getAlumniOpenings(): Promise<PublicAlumniOpening[]> {
  return (await request<PublicAlumniOpening[]>("/api/alumni-openings")).data;
}
