import { TrendingUp } from "lucide-react";

function StatsCards({ data }) {
  return (
    <section className="grid grid-cols-2 gap-3">
      <div className="col-span-2 rounded-2xl border border-white/5 bg-[#201f1f] p-4">
        <p className="mb-1 text-sm text-zinc-400">
          Miembros Activos
        </p>

        <h2 className="text-3xl font-bold text-white">
          {data?.activeMembers ?? 0}
        </h2>

        <div className="mt-3 flex items-center gap-1">
          <TrendingUp size={18} className="text-blue-400" />

          <span className="text-sm text-blue-400">
            Datos en tiempo real
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
        <p className="mb-1 text-sm text-zinc-400">
          Ingresos
        </p>

        <h2 className="text-2xl font-bold text-white">
          ${data?.totalRevenue ?? 0}
        </h2>

        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-3/4 bg-blue-500"></div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
        <p className="mb-1 text-sm text-zinc-400">
          Próximos Vencimientos
        </p>

        <h2 className="text-2xl font-bold text-red-300">
          {data?.expiringSoon ?? 0}
        </h2>

        <p className="mt-1 text-sm text-zinc-400">
          Próximos 7 días
        </p>
      </div>
    </section>
  );
}

export default StatsCards;