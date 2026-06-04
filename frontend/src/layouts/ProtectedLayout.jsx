import { Navigate } from "react-router-dom";
import useAuthStore from "../store/auth.store";

export default function ProtectedLayout({ children }) {
  const token = useAuthStore((state) => state.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
