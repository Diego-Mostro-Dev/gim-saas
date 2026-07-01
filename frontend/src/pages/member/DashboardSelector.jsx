import { useOutletContext } from "react-router-dom";

import { useGymFeatures } from "../../hooks/useGymFeatures";
import GymDashboard from "./GymDashboard";
import ActivityDashboard from "./ActivityDashboard";

function DashboardSelector() {
  const { routine } = useOutletContext();
  const isActivityOnly = routine?.member?.entry_mode === "ACTIVITY_ONLY";
  const { extrasEnabled } = useGymFeatures(routine?.gym?.features);

  if (isActivityOnly && extrasEnabled) {
    return <ActivityDashboard />;
  }

  return <GymDashboard />;
}

export default DashboardSelector;
