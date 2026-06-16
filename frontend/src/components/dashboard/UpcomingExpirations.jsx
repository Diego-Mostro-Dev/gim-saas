import { useNavigate } from "react-router-dom";

function UpcomingExpirations({ expirations = [] }) {
  const navigate = useNavigate();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">
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
          <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm text-text-secondary shadow-sm">
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
                className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-input font-bold text-info-text dark:text-info">
                    {initials}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {item.member_name}
                    </p>

                    <p className="text-xs text-text-secondary">{item.plan_name}</p>
                  </div>
                </div>

                <div className="rounded-md bg-danger-bg dark:bg-danger/15 px-2 py-1 text-xs text-danger-text dark:text-danger">
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
