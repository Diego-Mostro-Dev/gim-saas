function UpcomingExpirations({ expirations }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Próximos Vencimientos
        </h3>

        <button className="text-sm text-blue-400">
          Ver Todos
        </button>
      </div>

      <div className="space-y-3">
        {expirations.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4 text-sm text-zinc-400">
            No hay vencimientos próximos
          </div>
        ) : (
          expirations.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#201f1f] p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2a2a2a] font-bold text-blue-300">
                  {item.member
                    .split(" ")
                    .map(word => word[0])
                    .join("")
                    .slice(0, 2)}
                </div>

                <div>
                  <p className="text-sm font-medium text-white">
                    {item.member}
                  </p>

                  <p className="text-xs text-zinc-400">
                    {item.plan}
                  </p>
                </div>
              </div>

              <div className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">
                {item.days_left} días restantes
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default UpcomingExpirations;