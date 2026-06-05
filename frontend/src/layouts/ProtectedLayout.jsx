import { Navigate, useLocation } from "react-router-dom";

import useAuthStore from "../store/auth.store";

export default function ProtectedLayout({ children }) {
  const token = useAuthStore((state) => state.token);

  const mustChangePassword = useAuthStore(
    (state) => state.must_change_password,
  );

  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return children;
}
