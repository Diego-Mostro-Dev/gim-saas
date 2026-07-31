function SubscriptionFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  renewalFilter,
  setRenewalFilter,
}) {
  return (
    <div className="mb-4 space-y-3">
      <input
        type="text"
        placeholder="Buscar miembro o teléfono..."
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
          <option value="all">Todos los miembros</option>
          <option value="active">Activos</option>
          <option value="pending">Pendientes de pago</option>
          <option value="expired">Sin ciclo vigente</option>
        </select>

        <select
          value={renewalFilter}
          onChange={(e) => setRenewalFilter(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        >
          <option value="all">Renovación: Todas</option>
          <option value="with_renewal">Con renovación automática</option>
          <option value="without_renewal">Sin renovación automática</option>
        </select>
      </div>
    </div>
  );
}

export default SubscriptionFilters;
