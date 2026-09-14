import { Navigate } from "react-router-dom";

import useAuthStore from "../../store/auth.store";

export default function AdminRoute({ children }) {
  const initialized = useAuthStore((state) => state.initialized);
  const isSuperuser = useAuthStore((state) => state.isSuperuser);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-secondary">
        <p className="text-sm">Cargando...</p>
      </div>
    );
  }

  if (!isSuperuser) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}