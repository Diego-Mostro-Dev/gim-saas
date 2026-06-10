import { useEffect, useState } from "react";

import {
  getAttendanceStatus,
  registerAttendance,
} from "../services/attendance.service";
import { getCached, isCacheFresh } from "../utils/cache";

const TTL = 60 * 1000;

export function useAttendanceStatus() {
  const [day, setDay] = useState(() => sessionStorage.getItem("attendance_day") || "tuesday");

  const [hour, setHour] = useState(() => sessionStorage.getItem("attendance_hour") || "08:00");

  function cacheKey(d, h) {
    return `attendance-status-${d}-${h}`;
  }

  const [members, setMembers] = useState(() => getCached(cacheKey(day, hour)) || []);

  const [loading, setLoading] = useState(() => !isCacheFresh(cacheKey(day, hour), TTL));

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState(null);

  function handleSetDay(newDay) {
    setDay(newDay);
    sessionStorage.setItem("attendance_day", newDay);
  }

  function handleSetHour(newHour) {
    setHour(newHour);
    sessionStorage.setItem("attendance_hour", newHour);
  }

  useEffect(() => {
    loadStatus();
  }, [day, hour]);

  async function loadStatus(forceRefresh = false) {
    const key = cacheKey(day, hour);
    if (!forceRefresh && isCacheFresh(key, TTL)) {
      setMembers(getCached(key));
      setLoading(false);
      setError(null);
      setRefreshing(true);
      try {
        const data = await getAttendanceStatus(day, hour);
        setMembers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setRefreshing(false);
      }
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const data = await getAttendanceStatus(
        day,
        hour,
      );

      setMembers(data);
    } catch (err) {
      console.error("ERROR REGISTER:", err);

      setError(
        err.message ||
        "Error registrando asistencia",
      );
    } finally {
      setLoading(false);
    }
  }

  async function markAttendance(
    scheduleId,
  ) {
    try {
      await registerAttendance(
        scheduleId,
      );

      await loadStatus(true);
    } catch (err) {
      console.error(err);

      setError(
        "Error registrando asistencia",
      );
    }
  }

  return {
    day,
    setDay: handleSetDay,
    hour,
    setHour: handleSetHour,
    members,
    loading,
    refreshing,
    error,
    markAttendance,
    reload: () => loadStatus(true),
  };
}
