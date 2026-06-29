import { Pencil, Trash2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

function ActivityCard({
  activity,
  onEdit,
  onDelete,
  onToggleActive,
}) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-lg font-semibold text-text-primary">
            {activity.name}
          </h3>

          {activity.active ? (
            <span className="shrink-0 rounded-md bg-success-bg px-2 py-0.5 text-xs font-medium text-success-text dark:bg-success/15 dark:text-success">
              Activo
            </span>
          ) : (
            <span className="shrink-0 rounded-md bg-muted-bg px-2 py-0.5 text-xs font-medium text-muted-text">
              Inactivo
            </span>
          )}
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

          <button
            onClick={() => onDelete(activity.id)}
            className="rounded-lg bg-danger-bg p-3 text-danger-text transition hover:bg-danger-bg dark:bg-danger/15 dark:text-danger"
            title="Eliminar actividad"
            aria-label="Eliminar actividad"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {activity.description && (
        <p className="mt-2 text-sm text-text-secondary line-clamp-2">
          {activity.description}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => onToggleActive(activity.id, !activity.active)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition sm:self-start ${
            activity.active
              ? "bg-muted-bg text-muted-text hover:bg-danger-bg hover:text-danger-text dark:bg-muted-bg dark:text-muted-text"
              : "bg-success-bg text-success-text hover:brightness-90 dark:bg-success/15 dark:text-success"
          }`}
          aria-label={activity.active ? "Desactivar actividad" : "Activar actividad"}
        >
          {activity.active ? "Desactivar" : "Activar"}
        </button>
      </div>
    </div>
  );
}

export default ActivityCard;
