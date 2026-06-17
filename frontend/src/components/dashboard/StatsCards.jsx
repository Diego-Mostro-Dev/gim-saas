import { TrendingUp, DollarSign, AlertTriangle, XCircle } from "lucide-react";

function StatsCards({ data }) {
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

          <AlertTriangle size={18} className="text-danger-text dark:text-danger" />
        </div>

        <h2 className="mt-2 text-3xl font-bold text-danger-text dark:text-danger">
          {data?.expiringSoon ?? 0}
        </h2>

        <p className="mt-2 text-sm text-text-secondary">Próximos 7 días</p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">Pagos Vencidos</p>

          <XCircle size={18} className="text-warning-text dark:text-warning" />
        </div>

        <h2 className="mt-2 text-3xl font-bold text-warning-text dark:text-warning">
          {data?.overdueCount ?? 0}
        </h2>

        <p className="mt-2 text-sm text-warning-text dark:text-warning">Día 11 al 15</p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">Accesos Suspendidos</p>

          <XCircle size={18} className="text-danger-text dark:text-danger" />
        </div>

        <h2 className="mt-2 text-3xl font-bold text-danger-text dark:text-danger">
          {data?.blockedCount ?? 0}
        </h2>

        <p className="mt-2 text-sm text-danger-text dark:text-danger">Sin pagar después del día 15</p>
      </div>
    </section>
  );
}

export default StatsCards;
