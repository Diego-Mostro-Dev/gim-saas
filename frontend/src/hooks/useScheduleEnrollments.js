import { useEffect, useState } from "react";

import {
  getScheduleEnrollments,
  unenrollMember,
} from "../services/scheduleEnrollments.service";
import { getActivity } from "../services/activities.service";

export function useScheduleEnrollments(scheduleId, activityId) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activityName, setActivityName] = useState("");

  async function load() {
    if (!scheduleId) return;

    try {
      setLoading(true);
      setError(null);

      const [enrollData, activityData] = await Promise.all([
        getScheduleEnrollments(scheduleId),
        activityId ? getActivity(activityId) : Promise.resolve(null),
      ]);

      setEnrollments(enrollData);
      if (activityData) {
        setActivityName(activityData.name);
      }
    } catch (err) {
      console.error(err);
      setError("Error al cargar inscriptos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [scheduleId, activityId]);

  async function handleUnenroll(memberId) {
    try {
      await unenrollMember(scheduleId, memberId);
      setEnrollments((prev) =>
        prev.filter((e) => e.member.id !== memberId),
      );
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  return {
    enrollments,
    loading,
    error,
    activityName,
    handleUnenroll,
    reload: load,
  };
}
