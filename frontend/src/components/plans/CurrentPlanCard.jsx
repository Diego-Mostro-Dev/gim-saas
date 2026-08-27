import { formatHumanDate } from "../../utils/date.utils";

function CurrentPlanCard({ subscription }) {
  if (!subscription) {
    return (
      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <p className="text-sm text-text-secondary">No tenés una suscripción activa.</p>
      </div>
    );
  }

  const weeklyLabel =
    subscription.plan_weekly_visits !== null
      ? `${subscription.plan_weekly_visits} visitas por semana`
      : "Acceso ilimitado";

  const statusLabel =
    subscription.days_remaining > 0
      ? "Activo"
      : subscription.days_remaining === 0
        ? "Vence hoy"
        : "Vencido";

  const statusColor =
    subscription.days_remaining > 0
      ? "text-success-text dark:text-success"
      : "text-danger-text dark:text-danger";

  const activityItems = subscription.items?.filter(
    (i) => i.item_type === "activity"
  ) || [];

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-text-primary">
            {subscription.plan}
          </h3>
          <p className="mt-1 text-lg font-bold text-info-text dark:text-info">
            ${Number(subscription.plan_price).toLocaleString("es-AR")}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {subscription.plan_duration_days} días
          </p>
          <p className="mt-1 text-sm text-text-secondary">{weeklyLabel}</p>
          <p className="mt-2 text-sm text-text-secondary">
            Vence:{" "}
            <span className="text-text-primary">
              {formatHumanDate(subscription.end_date)}
            </span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor} bg-border/5`}>
          {statusLabel}
        </span>
      </div>

      {activityItems.length > 0 && (
        <div className="mt-4 border-t border-border pt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Actividades
          </p>
          {activityItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-text-primary">
                <span className="text-success-text dark:text-success">✓</span>
                {item.name}
              </span>
              <span className="text-sm text-text-secondary">
                ${Number(item.price).toLocaleString("es-AR")}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <p className="text-sm font-semibold text-text-secondary">Total</p>
            <p className="text-sm font-bold text-info-text dark:text-info">
              ${Number(subscription.total ?? subscription.plan_price).toLocaleString("es-AR")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default CurrentPlanCard;
