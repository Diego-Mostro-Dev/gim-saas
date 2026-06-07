import { TrendingUp, DollarSign, AlertTriangle } from "lucide-react";

function StatsCards({ data }) {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">Miembros Activos</p>

          <TrendingUp size={18} className="text-blue-400" />
        </div>

        <h2 className="mt-2 text-3xl font-bold text-white">
          {data?.activeMembers ?? 0}
        </h2>

        <p className="mt-2 text-sm text-blue-400">Datos en tiempo real</p>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">Ingresos del Mes</p>

          <DollarSign size={18} className="text-green-400" />
        </div>

        <h2 className="mt-2 text-3xl font-bold text-white">
          ${Number(data?.monthlyRevenue ?? 0).toLocaleString("es-AR")}
        </h2>

        <p className="mt-2 text-sm text-green-400">
          Cobros registrados este mes
        </p>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">Próximos Vencimientos</p>

          <AlertTriangle size={18} className="text-red-400" />
        </div>

        <h2 className="mt-2 text-3xl font-bold text-red-300">
          {data?.expiringSoon ?? 0}
        </h2>

        <p className="mt-2 text-sm text-zinc-400">Próximos 7 días</p>
      </div>
    </section>
  );
}

export default StatsCards;
