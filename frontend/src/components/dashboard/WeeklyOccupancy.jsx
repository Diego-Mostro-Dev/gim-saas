function WeeklyOccupancy({ weeklyAttendance }) {
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

  return (
    <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
      <h2 className="mb-4 text-lg font-semibold text-white">
        Ocupación semanal
      </h2>

      <div className="space-y-3">
        {days.map((day) => {
          const schedules = weeklyAttendance[day.key] || [];

          const count = schedules.length;

          const peopleLabel = count === 1 ? "persona" : "personas";

          return (
            <div key={day.key} className="rounded-xl bg-[#2a2a2a] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">{day.label}</span>

                <span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs text-blue-300">
                  {count} {peopleLabel}
                </span>
              </div>

              <div className="mt-3 space-y-1">
                {schedules.length === 0 ? (
                  <div className="text-xs text-zinc-500">
                    Sin asistencia registrada
                  </div>
                ) : (
                  schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs text-zinc-300"
                    >
                      {schedule.member_name}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeeklyOccupancy;
