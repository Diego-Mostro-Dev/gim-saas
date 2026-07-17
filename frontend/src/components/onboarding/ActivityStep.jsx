import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { DAY_NAMES } from "../../constants/days";
import { formatCurrency } from "../../utils/currency.utils";

function ActivityStep({ activities, selections, onChange }) {
  const [expanded, setExpanded] = useState(null);

  if (!activities || activities.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center">
        <p className="text-sm text-text-secondary">
          No hay actividades disponibles para este gimnasio.
        </p>
      </div>
    );
  }

  function isSelected(scheduleId) {
    return selections.some((s) => s.schedule_id === scheduleId);
  }

  function handleToggle(activityId, scheduleId, availableSpots) {
    if (availableSpots !== undefined && availableSpots <= 0) return;
    if (isSelected(scheduleId)) {
      onChange(selections.filter((s) => s.schedule_id !== scheduleId));
    } else {
      onChange([...selections, { activity_id: activityId, schedule_id: scheduleId }]);
    }
  }

  function getSelectionCount(activityId) {
    return selections.filter((s) => s.activity_id === activityId).length;
  }

  function formatTime(t) {
    if (!t) return "";
    return t.slice(0, 5);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-text-primary">
        Elegí tus actividades
      </p>

      <p className="text-sm text-text-secondary">
        Seleccioná uno o más horarios de las actividades disponibles.
      </p>

      {selections.length > 0 && (
        <p className="text-xs text-info">
          {selections.length} horario{selections.length !== 1 ? "s" : ""} seleccionado{selections.length !== 1 ? "s" : ""}
        </p>
      )}

      <div className="space-y-3">
        {activities.map((activity) => {
          const count = getSelectionCount(activity.id);
          const isExpanded = expanded === activity.id;

          return (
            <div
              key={activity.id}
              className="rounded-xl border border-border bg-surface-elevated overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : activity.id)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-text-primary">
                      {activity.name}
                    </h3>
                    {count > 0 && (
                      <span className="rounded-full bg-info/15 px-2 py-0.5 text-xs font-medium text-info">
                        {count}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {activity.description && (
                      <p className="text-sm text-text-secondary line-clamp-1">
                        {activity.description}
                      </p>
                    )}
                  </div>
                  {activity.monthly_price && Number(activity.monthly_price) > 0 && (
                    <p className="mt-1 text-sm font-semibold text-info-text dark:text-info">
                      {formatCurrency(activity.monthly_price)}/mes
                    </p>
                  )}
                </div>

                {isExpanded ? (
                  <ChevronUp size={18} className="shrink-0 text-text-secondary" />
                ) : (
                  <ChevronDown size={18} className="shrink-0 text-text-secondary" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-border px-4 py-3">
                  {activity.schedules && activity.schedules.length > 0 ? (
                    <div className="space-y-2">
                      {activity.schedules.map((schedule) => {
                        const selected = isSelected(schedule.id);
                        const isFull = schedule.available_spots !== undefined && schedule.available_spots <= 0;

                        return (
                          <div
                            key={schedule.id}
                            onClick={() => !isFull && handleToggle(activity.id, schedule.id, schedule.available_spots)}
                            role="button"
                            tabIndex={isFull ? -1 : 0}
                            onKeyDown={(e) => {
                              if (!isFull && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                handleToggle(activity.id, schedule.id, schedule.available_spots);
                              }
                            }}
                            className={`flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-0 sm:justify-between rounded-lg border p-3 transition ${
                              isFull
                                ? "border-border bg-surface-input opacity-50 cursor-not-allowed"
                                : selected
                                  ? "cursor-pointer border-info bg-info-bg"
                                  : "cursor-pointer border-border bg-surface-input hover:border-border"
                            }`}
                          >
                            <div className="flex items-start gap-3 sm:items-center">
                              <div className={`mt-0.5 shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center ${
                                isFull
                                  ? "border-text-secondary/40 bg-surface-input"
                                  : selected
                                    ? "border-info bg-info"
                                    : "border-text-secondary"
                              }`}>
                                {selected && (
                                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>

                              <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3 min-w-0">
                                <span className="text-sm text-text-primary">
                                  {DAY_NAMES[schedule.day] || schedule.day}
                                </span>
                                <span className="text-sm text-text-secondary">
                                  {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                                </span>
                              </div>
                            </div>

                            <span className={`text-xs ${
                              schedule.available_spots > 0
                                ? "text-text-secondary"
                                : "text-danger"
                            }`}>
                              {schedule.available_spots > 0
                                ? `${schedule.available_spots} cupo${schedule.available_spots !== 1 ? "s" : ""}`
                                : "Completo"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-text-secondary">
                      No hay horarios disponibles para esta actividad.
                    </p>
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

export default ActivityStep;
