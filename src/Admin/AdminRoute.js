import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "./AdminAuthContext";

export function RequireStaff({ children }) {
  const { admin_user } = useAdminAuth();
  const location = useLocation();

  if (!admin_user || !admin_user.is_staff) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  return children;
}

export function RequireSuperuser({ children }) {
  const { admin_user } = useAdminAuth();

  if (!admin_user || !admin_user.is_superuser) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
