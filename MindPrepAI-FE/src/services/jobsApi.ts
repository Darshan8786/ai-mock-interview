import axios from "axios";
import { BACKEND_URL } from "../config/config";

const api = axios.create({ baseURL: `${BACKEND_URL}/api/v1` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface JobEligibilityDTO {
  minimumCGPA: number | null;
  maximumBacklogs: number | null;
  allowedDepartments: string[];
}

export interface StudentJob {
  id: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  location: string;
  jobType: string;
  package: string;
  requiredSkills: string[];
  eligibility: JobEligibilityDTO;
  lastDateToApply: string;
  numberOfOpenings: number;
  companyWebsite: string;
  applicationLink: string;
  experience: string;
  responsibilities: string;
  qualifications: string;
  selectionProcess: string;
  status: string;
  postedAt: string;
  eligibilityDetails: {
    eligible: boolean;
    reasons: string[];
  };
  hasApplied: boolean;
  application?: { _id: string; status: string; createdAt: string } | null;
}

export interface StudentApplication {
  id: string;
  jobId: string;
  companyName: string;
  jobTitle: string;
  location: string;
  jobType: string;
  package: string;
  jobStatus: string;
  lastDateToApply: string | null;
  studentName: string;
  usn: string;
  email: string;
  department: string;
  cgpa: number | null;
  resumeUrl: string;
  status: "applied" | "shortlisted" | "rejected" | "selected" | "withdrawn";
  appliedAt: string;
}

export interface JobListParams {
  q?: string;
  jobType?: string;
  location?: string;
  company?: string;
  sort?: "latest" | "deadline";
}

export const getAvailableJobs = async (params: JobListParams = {}): Promise<StudentJob[]> => {
  const res = await api.get("/jobs", { params });
  return res.data.data || [];
};

export const getJobDetail = async (id: string): Promise<StudentJob> => {
  const res = await api.get(`/jobs/${id}`);
  return res.data.data;
};

export const applyToJob = async (id: string): Promise<any> => {
  const res = await api.post(`/jobs/${id}/apply`);
  return res.data;
};

export const getMyApplications = async (): Promise<StudentApplication[]> => {
  const res = await api.get("/applications/my");
  return res.data.data || [];
};
