import { Navigate } from "react-router-dom";
import { useFeature } from "./FeatureProvider";

function ProtectedFeature({ feature, children }) {
  const enabled = useFeature(feature);
  if (!enabled) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default ProtectedFeature;
