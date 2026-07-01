import { useEffect, useState } from "react";

import {
  getActivitySchedules,
  createActivitySchedule,
  updateActivitySchedule,
  deleteActivitySchedule,
} from "../services/activitySchedules.service";
import { getScheduleEnrollmentCount } from "../services/scheduleEnrollments.service";
import { getCached, isCacheFresh } from "../utils/cache";

const TTL = 30 * 60 * 1000;

async function enrichSchedules(schedules) {
  if (schedules.length === 0) return schedules;

  const counts = await Promise.allSettled(
    schedules.map((s) => getScheduleEnrollmentCount(s.id)),
  );

  return schedules.map((s, i) => ({
    ...s,
    enrolled_count:
      counts[i].status === "fulfilled" ? counts[i].value : 0,
  }));
}

export function useActivitySchedules(activityId) {
  const cacheKey = `activitySchedules_${activityId}`;

  const [schedules, setSchedules] = useState(
    () => getCached(cacheKey) || [],
  );

  const [loading, setLoading] = useState(
    () => activityId != null && !isCacheFresh(cacheKey, TTL),
  );

  const [error, setError] = useState(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);

  async function loadSchedules() {
    if (!activityId) return;

    if (isCacheFresh(cacheKey, TTL)) {
      setSchedules(getCached(cacheKey));
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getActivitySchedules(activityId);
      const enriched = await enrichSchedules(data);
      setSchedules(enriched);
    } catch (err) {
      console.error(err);
      if (err.code === "FEATURE_DISABLED") {
        setFeatureDisabled(true);
      } else {
        setError("Error al cargar horarios");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSchedules();
  }, [activityId]);

  async function handleCreateSchedule(data) {
    try {
      const newSchedule = await createActivitySchedule(activityId, data);
      const [enriched] = await enrichSchedules([newSchedule]);
      setSchedules((prev) => [enriched, ...prev]);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async function handleUpdateSchedule(id, data) {
    try {
      const updated = await updateActivitySchedule(id, data);
      const [enriched] = await enrichSchedules([updated]);
      setSchedules((prev) =>
        prev.map((s) => (s.id === enriched.id ? enriched : s)),
      );
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async function handleDeleteSchedule(id) {
    try {
      await deleteActivitySchedule(id);
      setSchedules((prev) =>
        prev.filter((s) => s.id !== id),
      );
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  return {
    schedules,
    loading,
    error,
    featureDisabled,
    handleCreateSchedule,
    handleUpdateSchedule,
    handleDeleteSchedule,
  };
}
