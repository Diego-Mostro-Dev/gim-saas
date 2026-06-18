import { useNavigate } from "react-router-dom";
import MemberAvatar from "../common/MemberAvatar";

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
                  <MemberAvatar
                    photo={item.member_photo}
                    firstName={item.member_name?.split(" ")[0]}
                    lastName={item.member_name?.split(" ").slice(1).join(" ")}
                    size="md"
                  />

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
