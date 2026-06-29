import { useOutletContext } from "react-router-dom";
import GymDashboard from "./GymDashboard";
import ActivityDashboard from "./ActivityDashboard";

function DashboardSelector() {
  const { routine } = useOutletContext();
  const isActivityOnly = routine?.member?.entry_mode === "ACTIVITY_ONLY";

  if (isActivityOnly) {
    return <ActivityDashboard />;
  }

  return <GymDashboard />;
}

export default DashboardSelector;
