import { TrendingUp, DollarSign, AlertTriangle, XCircle, CheckCircle } from "lucide-react";

function StatsCards({ data }) {
  const expiringSoon = data?.expiringSoon ?? 0;
  const overdueCount = data?.overdueCount ?? 0;
  const blockedCount = data?.blockedCount ?? 0;
  const hasExpiringSoon = expiringSoon > 0;
  const hasOverdueCount = overdueCount > 0;
  const hasBlockedCount = blockedCount > 0;

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">Miembros Activos</p>

          <TrendingUp size={18} className="text-blue-400" />
        </div>

        <h2 className="mt-2 text-3xl font-bold text-text-primary">
          {data?.activeMembers ?? 0}
        </h2>

        <p className="mt-2 text-sm text-blue-400">Datos en tiempo real</p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">Ingresos del Mes</p>

          <DollarSign size={18} className="text-success-text dark:text-success" />
        </div>

        <h2 className="mt-2 text-3xl font-bold text-text-primary">
          ${Number(data?.currentMonthRevenue ?? 0).toLocaleString("es-AR")}
        </h2>

        <p className="mt-2 text-sm text-success-text dark:text-success">
          Mes anterior: $
          {Number(data?.previousMonthRevenue ?? 0).toLocaleString("es-AR")}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">Próximos Vencimientos</p>

          {hasExpiringSoon ? (
            <AlertTriangle size={18} className="text-warning-text dark:text-warning" />
          ) : (
            <CheckCircle size={18} className="text-success-text dark:text-success" />
          )}
        </div>

        <h2 className={`mt-2 text-3xl font-bold ${hasExpiringSoon ? "text-warning-text dark:text-warning" : "text-text-primary"}`}>
          {expiringSoon}
        </h2>

        <p className="mt-2 text-sm text-text-secondary">Próximos 7 días</p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">Pagos Vencidos</p>

          {hasOverdueCount ? (
            <XCircle size={18} className="text-warning-text dark:text-warning" />
          ) : (
            <CheckCircle size={18} className="text-success-text dark:text-success" />
          )}
        </div>

        <h2 className={`mt-2 text-3xl font-bold ${hasOverdueCount ? "text-warning-text dark:text-warning" : "text-text-primary"}`}>
          {overdueCount}
        </h2>

        <p className={`mt-2 text-sm ${hasOverdueCount ? "text-warning-text dark:text-warning" : "text-text-secondary"}`}>
          Entre día {((data?.paymentDueDay ?? 10) + 1)} y {((data?.accessBlockDay ?? 16) - 1)}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">Accesos Suspendidos</p>

          {hasBlockedCount ? (
            <XCircle size={18} className="text-danger-text dark:text-danger" />
          ) : (
            <CheckCircle size={18} className="text-success-text dark:text-success" />
          )}
        </div>

        <h2 className={`mt-2 text-3xl font-bold ${hasBlockedCount ? "text-danger-text dark:text-danger" : "text-text-primary"}`}>
          {blockedCount}
        </h2>

        <p className={`mt-2 text-sm ${hasBlockedCount ? "text-danger-text dark:text-danger" : "text-text-secondary"}`}>
          Desde día {data?.accessBlockDay ?? 16}
        </p>
      </div>
    </section>
  );
}

export default StatsCards;
