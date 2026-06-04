import { Navigate } from "react-router-dom";
import useAuthStore from "../store/auth.store";

export default function OnboardingRoute({ children }) {
  const token = useAuthStore((state) => state.token);
  const gym = useAuthStore((state) => state.gym);

  // no logueado → login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // ya tiene gym → no debería volver onboarding
  if (gym) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
