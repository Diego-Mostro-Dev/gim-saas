import { Pencil, Trash2 } from "lucide-react";

function PlanCard({ plan, onEdit, onDelete }) {
  const weeklyLabel =
    plan.weekly_visits !== null && plan.weekly_visits !== undefined
      ? `${plan.weekly_visits} visitas/semana`
      : "Acceso ilimitado";

  return (
    <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
            {!plan.active && (
              <span className="rounded-md bg-zinc-500/20 px-2 py-0.5 text-xs font-medium text-zinc-400">
                Inactivo
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-zinc-400">{plan.duration_days} días</p>

          <p className="mt-0.5 text-sm font-medium text-blue-400">{weeklyLabel}</p>

          {plan.description && (
            <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{plan.description}</p>
          )}
        </div>

        <div className="rounded-xl bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-300">
          ${plan.price}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={() => onEdit(plan)}
          className="rounded-lg bg-blue-500/10 p-2 text-blue-300 transition hover:bg-blue-500/20"
        >
          <Pencil size={16} />
        </button>

        <button
          onClick={() => onDelete(plan.id)}
          className="rounded-lg bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default PlanCard;
