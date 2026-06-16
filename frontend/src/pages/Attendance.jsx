import { useEffect, useRef } from "react";
import AttendanceStatus from "../components/attendance/AttendanceStatus";
import WeeklyOccupancy from "../components/attendance/WeeklyOccupancy";

import { useWeeklyAttendance } from "../hooks/useWeeklyAttendance";

function Attendance() {
  const { weeklyAttendance, loading, error, reload, date, setDate } = useWeeklyAttendance();
  const lastLoadedAt = useRef(0);

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLoadedAt.current < 5 * 60 * 1000) {
        return;
      }
      lastLoadedAt.current = Date.now();
      reload();
    }

    document.addEventListener("visibilitychange", refreshIfVisible);

    const interval = setInterval(refreshIfVisible, 5 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      clearInterval(interval);
    };
  }, [reload]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando asistencia...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Asistencia</h1>

        <p className="mt-1 text-sm text-text-secondary">
          Organización semanal del gimnasio
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-danger-bg dark:bg-danger/10 p-4 text-sm text-danger-text dark:text-danger">
          {error}
        </div>
      )}

      {/* Registro de asistencia */}
      <div className="mb-6">
        <AttendanceStatus />
      </div>

      {/* Vista semanal */}
      <WeeklyOccupancy
        weeklyAttendance={weeklyAttendance}
        date={date}
        onDateChange={setDate}
      />
    </div>
  );
}

export default Attendance;
