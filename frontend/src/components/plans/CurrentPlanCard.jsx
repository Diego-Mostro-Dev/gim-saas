function formatDate(date) {
  return new Date(date).toLocaleDateString("es-AR");
}

function CurrentPlanCard({ subscription }) {
  if (!subscription) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
        <p className="text-sm text-zinc-500">No tenés una suscripción activa.</p>
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
      ? "text-green-400"
      : "text-red-400";

  return (
    <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">
            {subscription.plan}
          </h3>
          <p className="mt-1 text-xl font-semibold text-blue-400">
            ${Number(subscription.plan_price).toLocaleString("es-AR")}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {subscription.plan_duration_days} días
          </p>
          <p className="mt-1 text-sm text-zinc-400">{weeklyLabel}</p>
          <p className="mt-2 text-sm text-zinc-400">
            Vence:{" "}
            <span className="text-white">
              {formatDate(subscription.end_date)}
            </span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor} bg-white/5`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

export default CurrentPlanCard;
