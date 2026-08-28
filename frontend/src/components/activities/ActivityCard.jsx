import { Pencil, Clock, Power, ToggleLeft, Users, CalendarDays, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AVATAR_COLORS = [
  "bg-primary",
  "bg-info",
  "bg-success",
  "bg-warning",
  "bg-danger",
  "bg-muted",
];

function getAvatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function ActivityCard({
  activity,
  onEdit,
  onToggleActive,
}) {
  const navigate = useNavigate();

  const enrolledCount = activity.enrolled_count ?? 0;
  const scheduleCount = activity.schedule_count ?? 0;
  const hasPrice = Number(activity.monthly_price) > 0;
  const priceLabel = hasPrice
    ? `$${Number(activity.monthly_price).toLocaleString()}/mes`
    : "Gratis";

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white ${getAvatarColor(activity.name)}`}
            aria-hidden="true"
          >
            {activity.name?.charAt(0)?.toUpperCase() || "A"}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-text-primary">
              {activity.name}
            </h3>
            <div className="mt-0.5">
              {activity.active ? (
                <span className="rounded-md bg-success-bg px-2 py-0.5 text-xs font-medium text-success-text dark:bg-success/15 dark:text-success">
                  Activo
                </span>
              ) : (
                <span className="rounded-md bg-muted-bg px-2 py-0.5 text-xs font-medium text-muted-text">
                  Inactivo
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => navigate(`/activities/${activity.id}/schedules`)}
            className="rounded-lg bg-info-bg p-3 text-info-text transition hover:bg-info/20 dark:bg-info/15 dark:text-info"
            title="Horarios"
            aria-label="Ver horarios"
          >
            <Clock size={16} />
          </button>

          <button
            onClick={() => onEdit(activity)}
            className="rounded-lg bg-info-bg p-3 text-info-text transition hover:bg-info/20 dark:bg-info/15 dark:text-info"
            title="Editar actividad"
            aria-label="Editar actividad"
          >
            <Pencil size={16} />
          </button>
        </div>
      </div>

      {activity.description && (
        <p className="mt-2 text-sm text-text-secondary line-clamp-2">
          {activity.description}
        </p>
      )}

      {activity.instructor_name && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-text-secondary">
          <GraduationCap size={15} className="text-primary" />
          <span className="font-medium text-text-primary">{activity.instructor_name}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className={`font-medium ${hasPrice ? "text-primary" : "text-success-text dark:text-success"}`}>
          {priceLabel}
        </span>

        <span
          className={`inline-flex items-center gap-1.5 ${
            scheduleCount === 0 ? "text-warning-text dark:text-warning" : "text-text-secondary"
          }`}
        >
          <CalendarDays size={15} />
          {scheduleCount === 0
            ? "Sin horarios"
            : `${scheduleCount} ${scheduleCount === 1 ? "horario" : "horarios"}`}
        </span>

        <span className="inline-flex items-center gap-1.5 text-text-secondary">
          <Users size={15} />
          {enrolledCount} {enrolledCount === 1 ? "inscripto" : "inscriptos"}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => onToggleActive(activity.id, !activity.active)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition sm:self-start ${
            activity.active
              ? "bg-muted-bg text-muted-text hover:bg-danger-bg hover:text-white dark:bg-muted-bg dark:text-muted-text"
              : "bg-success-bg text-success-text hover:brightness-90 dark:bg-success/15 dark:text-success"
          }`}
          aria-label={activity.active ? "Desactivar actividad" : "Activar actividad"}
        >
          {activity.active ? <ToggleLeft size={14} /> : <Power size={14} />}
          {activity.active ? "Desactivar" : "Activar"}
        </button>
      </div>
    </div>
  );
}

export default ActivityCard;
