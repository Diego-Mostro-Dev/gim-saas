import { useEffect, useState } from "react";

import {
  getOutingSchedules,
  createOutingSchedule,
  updateOutingSchedule,
  deleteOutingSchedule,
  getScheduleOutingEnrollmentCount,
} from "../services/outingsEnrollments.service";
import { getCached, isCacheFresh } from "../utils/cache";

const TTL = 30 * 60 * 1000;

async function enrichSchedules(schedules) {
  if (schedules.length === 0) return schedules;

  const counts = await Promise.allSettled(
    schedules.map((s) => getScheduleOutingEnrollmentCount(s.id)),
  );

  return schedules.map((s, i) => ({
    ...s,
    enrolled_count:
      counts[i].status === "fulfilled" ? counts[i].value : 0,
  }));
}

export function useOutingSchedules(outingId) {
  const cacheKey = `outingSchedules_${outingId}`;

  const [schedules, setSchedules] = useState(
    () => getCached(cacheKey) || [],
  );

  const [loading, setLoading] = useState(
    () => outingId != null && !isCacheFresh(cacheKey, TTL),
  );

  const [error, setError] = useState(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);

  async function loadSchedules() {
    if (!outingId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getOutingSchedules(outingId);
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
  }, [outingId]);

  async function handleCreateSchedule(data) {
    try {
      const newSchedule = await createOutingSchedule(outingId, data);
      const [enriched] = await enrichSchedules([newSchedule]);
      setSchedules((prev) => [enriched, ...prev]);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async function handleUpdateSchedule(id, data) {
    try {
      const updated = await updateOutingSchedule(id, data);
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
      await deleteOutingSchedule(id);
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