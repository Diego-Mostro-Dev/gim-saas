function SubscriptionFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  paymentFilter,
  setPaymentFilter,
}) {
  return (
    <div className="mb-4 space-y-3">
      <input
        type="text"
        placeholder="Buscar miembro o plan..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        >
          <option value="all">Todas</option>
          <option value="active">Activas</option>
          <option value="expired">Vencidas</option>
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        >
          <option value="all">Todos los pagos</option>
          <option value="paid">Pagadas</option>
          <option value="pending">Pendientes</option>
        </select>
      </div>
    </div>
  );
}

export default SubscriptionFilters;
