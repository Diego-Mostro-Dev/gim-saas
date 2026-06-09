function WeeklyOccupancy({ weeklyAttendance, capacity }) {
  const days = [
    {
      key: "monday",
      label: "Lunes",
    },
    {
      key: "tuesday",
      label: "Martes",
    },
    {
      key: "wednesday",
      label: "Miércoles",
    },
    {
      key: "thursday",
      label: "Jueves",
    },
    {
      key: "friday",
      label: "Viernes",
    },
    {
      key: "saturday",
      label: "Sábado",
    },
  ];

  function groupByHour(schedules) {
    return schedules.reduce((acc, schedule) => {
      const hour = schedule.hour || "Sin horario";

      if (!acc[hour]) {
        acc[hour] = [];
      }

      acc[hour].push(schedule);

      return acc;
    }, {});
  }

  function getOccupancyInfo(count, cap) {
    if (!cap) return null;

    const ratio = count / cap;

    if (ratio >= 1) {
      return { label: "Completo", level: "full" };
    }

    if (ratio >= 0.8) {
      return { label: "Casi completo", level: "warning" };
    }

    return { label: "Disponible", level: "available" };
  }

  const badgeStyles = {
    available: "bg-green-500/10 text-green-400",
    warning: "bg-yellow-500/10 text-yellow-400",
    full: "bg-red-500/10 text-red-400",
  };

  const textStyles = {
    available: "text-green-400",
    warning: "text-yellow-400",
    full: "text-red-400",
  };

  return (
    <div className="space-y-4">
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

              {schedules.length > 0 && (() => {
                const info = getOccupancyInfo(
                  schedules.length,
                  capacity,
                );

                return (
                  <span
                    className={`rounded-md px-2 py-1 text-xs ${
                      info
                        ? badgeStyles[info.level]
                        : "bg-blue-500/10 text-blue-300"
                    }`}
                  >
                    {schedules.length} /{" "}
                    {capacity ?? schedules.length}
                    {info && ` · ${info.label}`}
                  </span>
                );
              })()}
            </div>

            {schedules.length === 0 ? (
              <div className="rounded-xl bg-[#2a2a2a] px-4 py-3 text-sm text-zinc-500">
                Sin socios programados
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedSchedules).map(
                  ([hour, people]) => {
                    const info = getOccupancyInfo(
                      people.length,
                      capacity,
                    );

                    return (
                      <div
                        key={hour}
                        className="rounded-xl bg-[#2a2a2a] p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium text-white">
                            {hour.slice(0, 5)}
                          </span>

                          <span
                            className={`text-xs ${
                              info
                                ? textStyles[info.level]
                                : "text-zinc-400"
                            }`}
                          >
                            {people.length} /{" "}
                            {capacity ?? people.length}
                            {info && ` · ${info.label}`}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {people.map((person) => (
                            <div
                              key={person.id}
                              className="rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs text-zinc-300"
                            >
                              {person.member_name}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default WeeklyOccupancy;
