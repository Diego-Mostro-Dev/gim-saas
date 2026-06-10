import { useEffect, useState } from "react";

import { getWeeklyAttendance } from "../services/attendance.service";
import { getCached, isCacheFresh } from "../utils/cache";

const TTL = 2 * 60 * 1000;

export function useWeeklyAttendance() {
  const [date, setDate] = useState(() => sessionStorage.getItem("attendance_date") || "");

  function cacheKey(d) {
    return `weekly-attendance-${d || ""}`;
  }

  const [weeklyAttendance, setWeeklyAttendance] =
    useState(() => getCached(cacheKey(date)) || {});

  const [loading, setLoading] = useState(() => !isCacheFresh(cacheKey(date), TTL));

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState(null);

  function handleSetDate(newDate) {
    setDate(newDate);
    if (newDate) {
      sessionStorage.setItem("attendance_date", newDate);
    } else {
      sessionStorage.removeItem("attendance_date");
    }
  }

  useEffect(() => {
    loadAttendance();
  }, [date]);

  async function loadAttendance() {
    const key = cacheKey(date);
    if (isCacheFresh(key, TTL)) {
      setWeeklyAttendance(getCached(key));
      setLoading(false);
      setError(null);
      setRefreshing(true);
      try {
        const data =
          await getWeeklyAttendance(date || undefined);
        setWeeklyAttendance(data);
      } catch (err) {
        console.error(err);
      } finally {
        setRefreshing(false);
      }
      return;
    }
    try {
      setLoading(true);

      const data =
        await getWeeklyAttendance(date || undefined);

      setWeeklyAttendance(data);
    } catch (err) {
      console.error(err);

      setError(
        "Error cargando asistencia semanal",
      );
    } finally {
      setLoading(false);
    }
  }

  return {
    weeklyAttendance,
    loading,
    refreshing,
    error,
    date,
    setDate: handleSetDate,
    reload: loadAttendance,
  };
}
