function formatDate(date) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("es-AR");
}

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
              {formatDate(subscription.end_date)}
            </span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor} bg-border/5`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

export default CurrentPlanCard;
