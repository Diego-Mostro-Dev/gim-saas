import { useNavigate } from "react-router-dom";

function UpcomingExpirations({ expirations = [] }) {
  const navigate = useNavigate();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Próximos Vencimientos
        </h3>

        <button
          onClick={() => navigate("/subscriptions?status=active")}
          className="text-sm text-blue-400"
        >
          Ver Todos
        </button>
      </div>

      <div className="space-y-3">
        {expirations.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4 text-sm text-zinc-400">
            No hay vencimientos próximos
          </div>
        ) : (
          expirations.map((item) => {
            const initials = item.member_name
              ?.split(" ")
              .map((word) => word[0])
              .join("")
              .slice(0, 2);

            const remainingText =
              Number(item.days_remaining) === 1
                ? "día restante"
                : "días restantes";

            return (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#201f1f] p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2a2a2a] font-bold text-blue-300">
                    {initials}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-white">
                      {item.member_name}
                    </p>

                    <p className="text-xs text-zinc-400">{item.plan_name}</p>
                  </div>
                </div>

                <div className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">
                  {item.days_remaining} {remainingText}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default UpcomingExpirations;
