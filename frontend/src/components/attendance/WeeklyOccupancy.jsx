import { formatHumanDate } from "../../utils/date.utils";
import { DAY_NAMES, DAY_ORDER } from "../../constants/days";

function getWeekRange(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts = { day: "2-digit", month: "2-digit" };
  const yearOpts = { day: "2-digit", month: "2-digit", year: "numeric" };
  return `${monday.toLocaleDateString("es-AR", opts)} – ${sunday.toLocaleDateString("es-AR", yearOpts)}`;
}

function weekdayKeyOf(dateStr) {
  if (!dateStr) return null;
  const map = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };
  return map[new Date(dateStr + "T12:00:00").getDay()] || null;
}

function weekDatesByKey(dateStr) {
  if (!dateStr) return {};
  const d = new Date(dateStr + "T12:00:00");
  const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const keys = [
    "monday", "tuesday", "wednesday", "thursday",
    "friday", "saturday", "sunday",
  ];
  const map = {};
  keys.forEach((key, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    const y = dd.getFullYear();
    const m = String(dd.getMonth() + 1).padStart(2, "0");
    const day = String(dd.getDate()).padStart(2, "0");
    map[key] = `${y}-${m}-${day}`;
  });
  return map;
}

function WeeklyOccupancy({ weeklyAttendance, date, onDateChange }) {
  const days = DAY_ORDER.map((key) => ({ key, label: DAY_NAMES[key] }));

  function groupByHour(schedules) {
    return schedules.reduce((acc, schedule) => {
      const hour = schedule.hour || "Sin horario";
      if (!acc[hour]) acc[hour] = [];
      acc[hour].push(schedule);
      return acc;
    }, {});
  }

  function getOccupancyInfo(occupancy, capacity) {
    if (!capacity) return null;
    const ratio = occupancy / capacity;
    if (ratio >= 1) return { label: "Completo", level: "full" };
    if (ratio >= 0.7) return { label: "Casi completo", level: "warning" };
    return { label: "Disponible", level: "available" };
  }

  const textStyles = {
    available: "text-success-text dark:text-success",
    warning: "text-warning-text dark:text-warning",
    full: "text-danger-text dark:text-danger",
  };

  const bgStyles = {
    available: "border-l-4 border-l-success",
    warning: "border-l-4 border-l-warning",
    full: "border-l-4 border-l-danger",
  };

  const weekRange = getWeekRange(date);
  const todayStr = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  const todayKey = weekdayKeyOf(todayStr);
  const selectedDayKey = weekdayKeyOf(date);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <p className="text-xs text-text-secondary">Fecha seleccionada</p>
        <p className="text-2xl font-bold text-text-primary">
          {date ? formatHumanDate(date) : "—"}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-44 rounded-lg bg-surface-input p-2 text-sm text-text-primary [color-scheme:dark]"
          />
          <button
            onClick={() => onDateChange(todayStr)}
            className="shrink-0 rounded-lg bg-zinc-700 px-3 py-2 text-xs text-text-primary hover:bg-zinc-600"
          >
            Hoy
          </button>
        </div>

        {date && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs text-text-secondary">Semana mostrada</p>
            <p className="text-lg font-medium text-text-primary">{weekRange}</p>
          </div>
        )}

        {!date && (
          <p className="mt-3 text-xs text-text-secondary">
            Seleccioná una fecha para ver la ocupación de la semana
          </p>
        )}
      </div>

      {days.map((day) => {
        const schedules = weeklyAttendance[day.key] || [];
        const groupedSchedules = groupByHour(schedules);
        const isToday = date === todayStr && day.key === todayKey;
        const isSelectedDay = date != null && day.key === selectedDayKey;
        const closedSet = new Set(weeklyAttendance.closed_dates || []);
        const isClosed = closedSet.has(weekDatesByKey(date)[day.key]) || false;

        return (
          <div
            key={day.key}
            className={`rounded-xl border bg-surface-elevated p-4 shadow-sm ${
              isClosed
                ? "border-danger/40 dark:bg-danger/5"
                : isToday
                  ? "border-success/60 ring-2 ring-success/30"
                  : isSelectedDay
                    ? "border-info/60"
                    : "border-border"
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-text-primary">{day.label}</h2>
                {isToday ? (
                  <span className="rounded-md bg-success-bg px-2 py-0.5 text-xs font-medium text-success-text dark:bg-success/15 dark:text-success">
                    Hoy
                  </span>
                ) : isSelectedDay ? (
                  <span className="rounded-md bg-info-bg px-2 py-0.5 text-xs font-medium text-info-text dark:bg-info/15 dark:text-info">
                    Seleccionado
                  </span>
                ) : null}
                {isClosed && (
                  <span className="rounded-md bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger-text dark:bg-danger/15 dark:text-danger">
                    Cerrado
                  </span>
                )}
              </div>
              {schedules.length > 0 && (
                <span className="rounded-md bg-info-bg px-2 py-1 text-xs text-info-text dark:bg-info/15 dark:text-info">
                  {schedules.length} socio{schedules.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {isClosed ? (
              <div className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text dark:bg-danger/10 dark:text-danger">
                Gimnasio cerrado este día
              </div>
            ) : schedules.length === 0 ? (
              <div className="rounded-xl bg-surface-input px-4 py-3 text-sm text-text-secondary">
                Sin socios programados
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedSchedules).map(([hour, people]) => {
                  const first = people[0];
                  const occupancy = first?.occupancy ?? people.length;
                  const capacity = first?.capacity;
                  const available = first?.available ?? Math.max(0, (capacity ?? people.length) - people.length);
                  const info = getOccupancyInfo(occupancy, capacity);
                  const pct = capacity ? Math.round((occupancy / capacity) * 100) : null;

                  return (
                    <div
                      key={hour}
                      className={`rounded-xl bg-surface-input p-3 ${
                        info ? bgStyles[info.level] : ""
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-text-primary">
                          {hour.slice(0, 5)}
                        </span>
                        <span
                          className={`text-xs ${
                            info ? textStyles[info.level] : "text-text-secondary"
                          }`}
                        >
                          {capacity
                            ? `${occupancy} / ${capacity}${pct != null ? ` (${pct}%)` : ""}`
                            : `${occupancy}`}
                          {info && ` · ${info.label}`}
                        </span>
                      </div>

                      {info && (
                      <div className="mb-2 text-xs text-text-secondary">
                        Disponibles: {available} de {capacity} lugares
                      </div>
                      )}

                      <div className="space-y-2">
                        {people.map((person) => (
                          <div
                            key={person.id}
                            className="flex items-center justify-between rounded-lg bg-surface-elevated px-3 py-2 text-xs text-text-primary"
                          >
                            <span>{person.member_name}</span>
                            {person.id < 0 && (
                              <span className="text-blue-400">↔ Intercambio</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default WeeklyOccupancy;
