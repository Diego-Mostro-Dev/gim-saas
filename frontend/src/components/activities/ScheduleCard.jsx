import { Pencil, Trash2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DAY_NAMES } from "../../constants/days";

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  return `${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
}

function getOccupancyColor(pct) {
  if (pct >= 90) return "danger";
  if (pct >= 60) return "warning";
  return "success";
}

function ScheduleCard({
  schedule,
  onEdit,
  onDelete,
}) {
  const navigate = useNavigate();
  const dayLabel = DAY_NAMES[schedule.day] || schedule.day;

  const capacity = schedule.capacity;
  const enrolled = schedule.enrolled_count ?? 0;
  const pct = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
  const color = getOccupancyColor(pct);
  const isFull = enrolled >= capacity;
  const isLastSpots = !isFull && capacity - enrolled < Math.max(1, Math.round(capacity * 0.2));

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-text-primary">
              {dayLabel}
            </h3>

            <span className="rounded-md bg-info-bg px-2 py-0.5 text-xs font-medium text-info-text dark:bg-info/15 dark:text-info">
              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
            </span>

            {isFull && (
              <span className="rounded-md bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger-text dark:bg-danger/15 dark:text-danger">
                Completo
              </span>
            )}

            {isLastSpots && (
              <span className="rounded-md bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-text dark:bg-warning/15 dark:text-warning">
                Últimos lugares
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm text-text-secondary">
              {enrolled} / {capacity}
            </span>

            <span
              className={`text-sm font-medium ${
                color === "danger"
                  ? "text-danger-text"
                  : color === "warning"
                    ? "text-warning-text"
                    : "text-success-text"
              }`}
            >
              {pct}%
            </span>
          </div>

          {/* PROGRESS BAR */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-input">
            <div
              className={`h-full rounded-full transition-all ${
                color === "danger"
                  ? "bg-danger"
                  : color === "warning"
                    ? "bg-warning"
                    : "bg-success"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
              role="progressbar"
              aria-valuenow={enrolled}
              aria-valuemin={0}
              aria-valuemax={capacity}
              aria-label={`${pct}% ocupado`}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() =>
            navigate(`/activities/schedules/${schedule.id}/enrollments`, {
              state: { schedule },
            })
          }
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-info-bg px-3 py-2 text-xs font-medium text-info-text transition hover:bg-info/30 dark:bg-info/15 dark:text-info sm:self-start"
          aria-label="Ver inscriptos"
        >
          <Users size={14} />
          Inscriptos ({enrolled})
        </button>

        <div className="flex items-center gap-2 sm:self-end">
          <button
            onClick={() => onEdit(schedule)}
            className="rounded-lg bg-info-bg p-3 text-info-text transition hover:bg-info/20 dark:bg-info/15 dark:text-info"
            title="Editar horario"
            aria-label="Editar horario"
          >
            <Pencil size={16} />
          </button>

          <button
            onClick={() => onDelete(schedule.id)}
            className="rounded-lg bg-danger-bg p-3 text-danger-text transition hover:bg-danger-bg dark:bg-danger/15 dark:text-danger"
            title="Eliminar horario"
            aria-label="Eliminar horario"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScheduleCard;
