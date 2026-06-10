import { useEffect, useState } from "react";

import { getWeeklyAttendance } from "../services/attendance.service";

export function useWeeklyAttendance() {
  const [weeklyAttendance, setWeeklyAttendance] =
    useState({});

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  useEffect(() => {
    loadAttendance();
  }, []);

  async function loadAttendance() {
    try {
      setLoading(true);

      const data =
        await getWeeklyAttendance();

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
    error,
    reload: loadAttendance,
  };
}