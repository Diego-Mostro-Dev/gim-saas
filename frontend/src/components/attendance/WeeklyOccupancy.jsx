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

function WeeklyOccupancy({ weeklyAttendance, date, onDateChange }) {
  const days = [
    { key: "monday", label: "Lunes" },
    { key: "tuesday", label: "Martes" },
    { key: "wednesday", label: "Miércoles" },
    { key: "thursday", label: "Jueves" },
    { key: "friday", label: "Viernes" },
    { key: "saturday", label: "Sábado" },
  ];

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
    available: "text-green-400",
    warning: "text-yellow-400",
    full: "text-red-400",
  };

  const bgStyles = {
    available: "border-l-4 border-l-green-500",
    warning: "border-l-4 border-l-yellow-500",
    full: "border-l-4 border-l-red-500",
  };

  const weekRange = getWeekRange(date);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full rounded-lg bg-[#2a2a2a] p-2 text-sm text-white [color-scheme:dark]"
          />
          {date && (
            <button
              onClick={() => onDateChange("")}
              className="shrink-0 rounded-lg bg-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-600"
            >
              Hoy
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          {date && (
            <span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs text-blue-300">
              {weekRange}
            </span>
          )}
          <p className="text-xs text-zinc-500">
            Seleccioná una fecha para ver la ocupación de la semana
          </p>
        </div>
      </div>

      {days.map((day) => {
        const schedules = weeklyAttendance[day.key] || [];
        const groupedSchedules = groupByHour(schedules);

        return (
          <div
            key={day.key}
            className="rounded-2xl border border-white/5 bg-[#201f1f] p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{day.label}</h2>
              {schedules.length > 0 && (
                <span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs text-blue-300">
                  {schedules.length} socio{schedules.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {schedules.length === 0 ? (
              <div className="rounded-xl bg-[#2a2a2a] px-4 py-3 text-sm text-zinc-500">
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
                      className={`rounded-xl bg-[#2a2a2a] p-3 ${
                        info ? bgStyles[info.level] : ""
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-white">
                          {hour.slice(0, 5)}
                        </span>
                        <span
                          className={`text-xs ${
                            info ? textStyles[info.level] : "text-zinc-400"
                          }`}
                        >
                          {capacity
                            ? `${occupancy} / ${capacity}${pct != null ? ` (${pct}%)` : ""}`
                            : `${occupancy}`}
                          {info && ` · ${info.label}`}
                        </span>
                      </div>

                      {info && (
                        <div className="mb-2 text-xs text-zinc-400">
                          Disponibles: {available} de {capacity} lugares
                        </div>
                      )}

                      <div className="space-y-2">
                        {people.map((person) => (
                          <div
                            key={person.id}
                            className="flex items-center justify-between rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs text-zinc-300"
                          >
                            <span>{person.member_name}</span>
                            {person.id < 0 && (
                              <span className="text-blue-400">↔ Intercambio de día</span>
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
