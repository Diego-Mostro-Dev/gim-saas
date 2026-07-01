import { useOutletContext } from "react-router-dom";

import { useFeature } from "../../hooks/useFeature";
import GymDashboard from "./GymDashboard";
import ActivityDashboard from "./ActivityDashboard";

function DashboardSelector() {
  const { routine } = useOutletContext();
  const isActivityOnly = routine?.member?.entry_mode === "ACTIVITY_ONLY";
  const activitiesEnabled = useFeature("activities");

  if (isActivityOnly && activitiesEnabled) {
    return <ActivityDashboard />;
  }

  return <GymDashboard />;
}

export default DashboardSelector;
