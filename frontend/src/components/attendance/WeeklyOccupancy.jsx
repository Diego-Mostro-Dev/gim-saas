import { useState } from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

function WeeklyOccupancy({ weeklyAttendance }) {
  const [openDay, setOpenDay] = useState(null);

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

  function toggleDay(dayKey) {
    if (openDay === dayKey) {
      setOpenDay(null);
    } else {
      setOpenDay(dayKey);
    }
  }

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

          const isOpen = openDay === day.key;

          return (
            <div key={day.key} className="rounded-xl bg-[#2a2a2a]">
              <button
                onClick={() => toggleDay(day.key)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  {isOpen ? (
                    <ChevronDown size={16} className="text-zinc-400" />
                  ) : (
                    <ChevronRight size={16} className="text-zinc-400" />
                  )}

                  <span className="text-sm text-white">{day.label}</span>
                </div>

                <span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs text-blue-300">
                  {count} {peopleLabel}
                </span>
              </button>

              {isOpen && (
                <div className="space-y-2 px-4 pb-4">
                  {schedules.length === 0 ? (
                    <div className="rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs text-zinc-500">
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeeklyOccupancy;
