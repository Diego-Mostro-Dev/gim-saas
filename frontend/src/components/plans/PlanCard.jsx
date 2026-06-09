import { Pencil, Trash2 } from "lucide-react";

function PlanCard({ plan, onEdit, onDelete }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{plan.name}</h3>

          <p className="mt-1 text-sm text-zinc-400">
            {plan.duration_days} días
          </p>
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
