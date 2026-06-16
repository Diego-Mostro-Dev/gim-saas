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
    <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-input font-bold text-info-text dark:text-info">
            {initials}
          </div>

          <div>
            <p className="font-medium text-text-primary">{subscription.member_name}</p>

            <p className="text-sm text-text-secondary">{subscription.plan_name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isExpired && (
            <button
              onClick={() => onRenew(subscription.id)}
              className="rounded-lg bg-success-bg dark:bg-success/15 p-2 text-success-text dark:text-success transition hover:bg-success-bg dark:hover:bg-success/20"
              title="Renovar"
            >
              <RefreshCw size={16} />
            </button>
          )}

          <button
            onClick={() => onEdit(subscription)}
            className="rounded-lg bg-info-bg p-2 text-info-text dark:bg-info/15 dark:text-info transition hover:bg-info/20"
          >
            <Pencil size={16} />
          </button>

          <button
            onClick={() => onDelete(subscription.id)}
            className="rounded-lg bg-danger-bg dark:bg-danger/15 p-2 text-danger-text dark:text-danger transition hover:bg-danger-bg dark:hover:bg-danger/20"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div>
          <p className="text-text-secondary">Inicio</p>

          <p className="text-text-primary">{subscription.start_date}</p>
        </div>

        <div>
          <p className="text-text-secondary">Fin</p>

          <p className="text-text-primary">{subscription.end_date}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div
          className={`inline-flex rounded-md px-2 py-1 text-xs ${
            isExpired
              ? "bg-danger-bg dark:bg-danger/15 text-danger-text dark:text-danger"
              : "bg-success-bg dark:bg-success/15 text-success-text dark:text-success"
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
              ? "bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
              : "bg-danger-bg dark:bg-danger/15 text-danger-text dark:text-danger"
          }`}
        >
          {subscription.paid ? "Pago" : "Pendiente"}
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs text-text-secondary">Valor del plan</p>

        <p className="text-sm font-semibold text-text-primary">
          ${Number(subscription.plan_price).toLocaleString("es-AR")}
        </p>
      </div>
    </div>
  );
}

export default SubscriptionCard;
