function SubscriptionStats({ stats }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-[#201f1f] p-4">
        <p className="text-sm text-zinc-400">Total</p>
        <p className="mt-1 text-2xl font-bold text-white">{stats.total}</p>
      </div>

      <div className="rounded-2xl bg-[#201f1f] p-4">
        <p className="text-sm text-zinc-400">Activas</p>
        <p className="mt-1 text-2xl font-bold text-green-300">{stats.active}</p>
      </div>

      <div className="rounded-2xl bg-[#201f1f] p-4">
        <p className="text-sm text-zinc-400">Vencidas</p>
        <p className="mt-1 text-2xl font-bold text-red-300">{stats.expired}</p>
      </div>

      <div className="rounded-2xl bg-[#201f1f] p-4">
        <p className="text-sm text-zinc-400">Pendientes</p>
        <p className="mt-1 text-2xl font-bold text-yellow-300">
          {stats.pending}
        </p>
      </div>
    </div>
  );
}

export default SubscriptionStats;
