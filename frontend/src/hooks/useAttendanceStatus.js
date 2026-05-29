import { useEffect, useState } from "react";

import {
  getAttendanceStatus,
  registerAttendance,
} from "../services/attendance.service";

export function useAttendanceStatus() {
  const [day, setDay] = useState("tuesday");

  const [hour, setHour] = useState("08:00");

  const [members, setMembers] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);

  useEffect(() => {
    loadStatus();
  }, [day, hour]);

  async function loadStatus() {
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

      await loadStatus();
    } catch (err) {
      console.error(err);

      setError(
        "Error registrando asistencia",
      );
    }
  }

  return {
    day,
    setDay,
    hour,
    setHour,
    members,
    loading,
    error,
    markAttendance,
    reload: loadStatus,
  };
}