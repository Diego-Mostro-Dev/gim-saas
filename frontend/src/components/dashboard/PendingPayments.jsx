import { useNavigate } from "react-router-dom";

function PendingPayments({ pendingPayments = [] }) {
  const navigate = useNavigate();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">
          Pendientes de cobro
        </h3>

        <span className="text-sm text-text-secondary">{pendingPayments.length}</span>
      </div>

      <div className="space-y-3">
        {pendingPayments.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm text-text-secondary shadow-sm">
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
              <button
                key={item.id}
                onClick={() =>
                  navigate("/payments", {
                    state: {
                      prefillMemberId: item.member_id,
                      prefillSubscriptionId: item.id,
                    },
                  })
                }
                className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-elevated p-4 text-left transition hover:bg-surface-input shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-input font-bold text-warning-text dark:text-warning">
                    {initials}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {item.member_name}
                    </p>

                    <p className="text-xs text-text-secondary">{item.plan_name}</p>
                  </div>
                </div>

                <div className="rounded-md bg-warning-bg dark:bg-warning/15 px-3 py-1 text-xs font-medium text-warning-text dark:text-warning">
                  ${Number(item.plan_price).toLocaleString()}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

export default PendingPayments;
