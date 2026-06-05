function PendingPayments({ pendingPayments = [] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Pendientes de Cobro
        </h3>

        <span className="text-sm text-zinc-400">{pendingPayments.length}</span>
      </div>

      <div className="space-y-3">
        {pendingPayments.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4 text-sm text-zinc-400">
            No hay pagos pendientes
          </div>
        ) : (
          pendingPayments.map((item) => {
            const initials = item.member_name
              ?.split(" ")
              .map((word) => word[0])
              .join("")
              .slice(0, 2);

            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#201f1f] p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2a2a2a] font-bold text-yellow-300">
                    {initials}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-white">
                      {item.member_name}
                    </p>

                    <p className="text-xs text-zinc-400">{item.plan_name}</p>
                  </div>
                </div>

                <div className="rounded-md bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-300">
                  ${Number(item.plan_price).toLocaleString()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default PendingPayments;
