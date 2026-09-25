import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function AuthLoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-accent-500 dark:border-gray-700" />
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoadingFallback />;
  if (!user) return <Navigate to="/login" replace />;

  return children ?? <Outlet />;
}
