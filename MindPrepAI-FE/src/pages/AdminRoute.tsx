import { Navigate, Outlet } from "react-router-dom";

export function AdminRoute() {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/admin/signin" replace />;
  }

  const role = localStorage.getItem("role");

  try {
    if (role) {
      if (role !== "admin") {
        return <Navigate to="/dashboard" replace />;
      }
    } else {
      // No stored role: fall back to decoding the JWT payload if the
      // backend includes a `role` claim (added in authController).
      const payload = JSON.parse(atob(token.split(".")[1] || "{}"));
      if (payload.role && payload.role !== "admin") {
        return <Navigate to="/dashboard" replace />;
      }
    }
  } catch {
    // malformed token payload — fall through to render
  }

  return <Outlet />;
}
