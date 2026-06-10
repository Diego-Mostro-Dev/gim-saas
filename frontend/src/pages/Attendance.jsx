import { useEffect } from "react";
import AttendanceStatus from "../components/attendance/AttendanceStatus";
import WeeklyOccupancy from "../components/attendance/WeeklyOccupancy";

import { useWeeklyAttendance } from "../hooks/useWeeklyAttendance";

function Attendance() {
  const { weeklyAttendance, loading, error, reload } = useWeeklyAttendance();

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        reload();
      }
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
      <div className="flex min-h-screen items-center justify-center bg-[#131313] text-white">
        Cargando asistencia...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131313] px-4 pb-28 pt-6 text-white">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Asistencia</h1>

        <p className="mt-1 text-sm text-zinc-400">
          Organización semanal del gimnasio
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Registro de asistencia */}
      <div className="mb-6">
        <AttendanceStatus />
      </div>

      {/* Vista semanal */}
      <WeeklyOccupancy weeklyAttendance={weeklyAttendance} />
    </div>
  );
}

export default Attendance;
