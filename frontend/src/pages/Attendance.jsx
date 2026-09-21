import { useEffect, useRef, useState } from "react";
import AttendanceStatus from "../components/attendance/AttendanceStatus";
import WeeklyOccupancy from "../components/attendance/WeeklyOccupancy";

import { useWeeklyAttendance } from "../hooks/useWeeklyAttendance";
import { useClosedDates } from "../hooks/useClosedDates";
import { useGym } from "../hooks/useGym";
import { useFeature } from "../hooks/useFeature";
import { txt } from "../utils/labels";
import ClosedDatesNotice from "../components/members/ClosedDatesNotice";
import PersonalTrainingAttendance from "./PersonalTrainingAttendance";
import { CalendarDays, Dumbbell } from "lucide-react";

function Attendance() {
  const { gym } = useGym();
  const personalTrainingEnabled = useFeature("personal_training");
  const { weeklyAttendance, openDays, closedDates, loading, error, reload, date, setDate } = useWeeklyAttendance();
  const { closedDates: allClosedDates } = useClosedDates();
  const lastLoadedAt = useRef(0);

  const [activeTab, setActiveTab] = useState(() =>
    sessionStorage.getItem("attendance_tab") === "pt"
      ? "pt"
      : "planilla",
  );

  function switchTab(tab) {
    setActiveTab(tab);
    sessionStorage.setItem("attendance_tab", tab);
  }

  const tabs = [
    { id: "planilla", label: "Planilla", icon: CalendarDays },
    ...(personalTrainingEnabled
      ? [{ id: "pt", label: "Entrenamiento", icon: Dumbbell }]
      : []),
  ];

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
          {txt(gym, "staff.attendance.title")}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-danger-bg dark:bg-danger/10 p-4 text-sm text-danger-text dark:text-danger">
          {error}
        </div>
      )}

      {tabs.length > 1 && (
        <div className="mb-6 flex items-center gap-1 rounded-xl border border-border bg-surface-elevated p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:bg-surface-input hover:text-text-primary"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "planilla" && (
        <>
          <div className="mb-8">
            <ClosedDatesNotice gym={gym} closedDates={allClosedDates} excludeToday compact bannerDaysAhead={7} maxDaysAhead={7} dropdown />
          </div>

          {/* Registro de asistencia */}
          <div className="mb-6">
            <AttendanceStatus gym={gym} openDays={openDays} closedDates={closedDates} />
          </div>

          {/* Vista semanal */}
          <WeeklyOccupancy
            gym={gym}
            weeklyAttendance={weeklyAttendance}
            date={date}
            onDateChange={setDate}
          />
        </>
      )}

      {activeTab === "pt" && <PersonalTrainingAttendance embedded />}
    </div>
  );
}

export default Attendance;
