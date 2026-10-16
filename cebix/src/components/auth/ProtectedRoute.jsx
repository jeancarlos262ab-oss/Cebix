import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

import { FullScreenSkeleton, pageKeyFromPath } from "../ui/PageSkeleton";

function AuthLoadingFallback() {
  return <FullScreenSkeleton page={pageKeyFromPath(window.location.pathname) ?? "dashboard"} />;
}

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoadingFallback />;
  if (!user) return <Navigate to="/login" replace />;

  return children ?? <Outlet />;
}
