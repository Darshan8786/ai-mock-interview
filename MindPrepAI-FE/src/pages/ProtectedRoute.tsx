import { Navigate, Outlet } from "react-router-dom";

export function ProtectedRoute() {
  const token = localStorage.getItem("token"); // or use auth context
  if (!token) {
    return <Navigate to="/signin" replace />;
  }
  return <Outlet />; // renders nested routes
}
