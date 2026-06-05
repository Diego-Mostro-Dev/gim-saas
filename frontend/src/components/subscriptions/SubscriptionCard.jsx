import { Pencil, Trash2, RefreshCw } from "lucide-react";

import {
  calculateRemainingDays,
  isSubscriptionExpired,
  getMemberInitials,
} from "../../utils/subscription.utils";

function SubscriptionCard({ subscription, onEdit, onDelete, onRenew }) {
  const isExpired = isSubscriptionExpired(subscription.end_date);

  const daysRemaining = calculateRemainingDays(subscription.end_date);

  const initials = getMemberInitials(subscription.member_name);

  return (
    <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2a2a2a] font-bold text-blue-300">
            {initials}
          </div>

          <div>
            <p className="font-medium text-white">{subscription.member_name}</p>

            <p className="text-sm text-zinc-400">{subscription.plan_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isExpired && (
            <button
              onClick={() => onRenew(subscription.id)}
              className="rounded-lg bg-green-500/10 p-2 text-green-300 transition hover:bg-green-500/20"
              title="Renovar"
            >
              <RefreshCw size={16} />
            </button>
          )}

          <button
            onClick={() => onEdit(subscription)}
            className="rounded-lg bg-blue-500/10 p-2 text-blue-300 transition hover:bg-blue-500/20"
          >
            <Pencil size={16} />
          </button>

          <button
            onClick={() => onDelete(subscription.id)}
            className="rounded-lg bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div>
          <p className="text-zinc-500">Inicio</p>

          <p className="text-white">{subscription.start_date}</p>
        </div>

        <div>
          <p className="text-zinc-500">Fin</p>

          <p className="text-white">{subscription.end_date}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div
          className={`inline-flex rounded-md px-2 py-1 text-xs ${
            isExpired
              ? "bg-red-500/10 text-red-300"
              : "bg-green-500/10 text-green-300"
          }`}
        >
          {isExpired
            ? "Vencida"
            : `${daysRemaining} ${
                daysRemaining === 1 ? "día restante" : "días restantes"
              }`}
        </div>

        <div
          className={`rounded-md px-2 py-1 text-xs ${
            subscription.paid
              ? "bg-blue-500/10 text-blue-300"
              : "bg-red-500/10 text-red-300"
          }`}
        >
          {subscription.paid ? "Pago" : "Pendiente"}
        </div>
      </div>

      <div className="mt-3 border-t border-white/5 pt-3">
        <p className="text-xs text-zinc-500">Valor del plan</p>

        <p className="text-sm font-semibold text-white">
          ${Number(subscription.plan_price).toLocaleString("es-AR")}
        </p>
      </div>
    </div>
  );
}

export default SubscriptionCard;
