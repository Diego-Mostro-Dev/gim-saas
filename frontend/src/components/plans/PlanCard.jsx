import { Pencil, Trash2 } from "lucide-react";

function PlanCard({ plan, onEdit, onDelete }) {
  const weeklyLabel =
    plan.weekly_visits !== null && plan.weekly_visits !== undefined
      ? `${plan.weekly_visits} visitas/semana`
      : "Acceso ilimitado";

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-text-primary">{plan.name}</h3>
            {!plan.active && (
              <span className="rounded-md bg-muted-bg px-2 py-0.5 text-xs font-medium text-muted-text">
                Inactivo
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-text-secondary">{plan.duration_days} días</p>

          <p className="mt-0.5 text-sm font-medium text-blue-400">{weeklyLabel}</p>

          {plan.description && (
            <p className="mt-1 text-sm text-text-secondary line-clamp-2">{plan.description}</p>
          )}
        </div>

        <div className="rounded-xl border border-info/20 bg-info-bg px-3 py-2 text-sm font-bold text-info-text dark:bg-info/15 dark:text-info shadow-sm">
          ${plan.price}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={() => onEdit(plan)}
          className="rounded-lg bg-info-bg p-2 text-info-text dark:bg-info/15 dark:text-info transition hover:bg-info/20"
        >
          <Pencil size={16} />
        </button>

        <button
          onClick={() => onDelete(plan.id)}
          className="rounded-lg bg-danger-bg dark:bg-danger/15 p-2 text-danger-text dark:text-danger transition hover:bg-danger-bg dark:hover:bg-danger/20"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default PlanCard;
