import axios from "axios";
import { BACKEND_URL } from "../config/config";

const api = axios.create({ baseURL: `${BACKEND_URL}/api/v1` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface StudentNotification {
  id: string;
  type: "job_eligible" | "job_status" | "general";
  title: string;
  body: string;
  read: boolean;
  job: {
    id: string;
    companyName: string;
    jobTitle: string;
    package: string | null;
    location: string;
    lastDateToApply: string | null;
  } | null;
  createdAt: string;
}

export interface NotificationsResponse {
  unread: number;
  notifications: StudentNotification[];
}

export const getMyNotifications = async (): Promise<NotificationsResponse> => {
  const res = await api.get("/notifications/my");
  return res.data.data || { unread: 0, notifications: [] };
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await api.patch(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await api.patch("/notifications/read-all");
};
