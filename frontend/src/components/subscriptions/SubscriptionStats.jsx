function SubscriptionStats({ stats }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3">
      <div className="rounded-xl bg-surface-elevated p-4">
        <p className="text-sm text-text-secondary">Miembros</p>
        <p className="mt-1 text-2xl font-bold text-text-primary">{stats.total}</p>
      </div>

      <div className="rounded-xl bg-surface-elevated p-4">
        <p className="text-sm text-text-secondary">Activos</p>
        <p className="mt-1 text-2xl font-bold text-success-text dark:text-success">{stats.active}</p>
      </div>

      <div className="rounded-xl bg-surface-elevated p-4">
        <p className="text-sm text-text-secondary">Pendientes de pago</p>
        <p className="mt-1 text-2xl font-bold text-warning-text dark:text-warning">{stats.pending}</p>
      </div>

      <div className="rounded-xl bg-surface-elevated p-4">
        <p className="text-sm text-text-secondary">Sin renovación</p>
        <p className="mt-1 text-2xl font-bold text-danger-text dark:text-danger">{stats.noRenewal}</p>
      </div>
    </div>
  );
}

export default SubscriptionStats;
