import { useOutletContext } from "react-router-dom";
import { formatHumanDate } from "../../utils/date.utils";

function MemberPayments() {
  const { routine } = useOutletContext();
  const { payments, outstanding_debt } = routine;

  const pendingItems = outstanding_debt?.subscriptions || [];

  function renderPendiente(item) {
    if (item.type === "activity_package") {
      return {
        key: `enroll-${item.enrollment_id}`,
        title: item.name,
        remaining: `$${Number(item.remaining).toLocaleString("es-AR")}`,
        total: `$${Number(item.total).toLocaleString("es-AR")}`,
        period: `${item.sessions_total} sesiones`,
        unit: item.session_price != null
          ? `$${Number(item.session_price).toLocaleString("es-AR")}/sesión`
          : null,
      };
    }
    return {
      key: `sub-${item.subscription_id}`,
      title: item.plan,
      remaining: `$${Number(item.remaining).toLocaleString("es-AR")}`,
      total: `$${Number(item.total).toLocaleString("es-AR")}`,
      period: item.start_date && item.end_date
        ? `${formatHumanDate(item.start_date)} - ${formatHumanDate(item.end_date)}`
        : "",
      unit: null,
    };
  }

  return (
    <div className="space-y-4">
      {pendingItems.length > 0 && (
        <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-danger dark:text-danger">
            Pagos pendientes
          </h2>

          <div className="space-y-2">
            {pendingItems.map((item) => {
              const p = renderPendiente(item);
              return (
                <div
                  key={p.key}
                  className="rounded-lg border border-danger/20 bg-danger-bg/10 px-4 py-3"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium text-text-primary">
                        {p.remaining}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {p.title}
                      </span>
                      {p.unit && (
                        <span className="text-xs text-text-secondary">
                          {p.unit}
                        </span>
                      )}
                      <span className="rounded bg-danger/10 px-1.5 py-0.5 text-xs text-danger dark:text-danger">
                        {p.total} total
                      </span>
                    </div>

                    {p.period && (
                      <span className="text-xs text-text-secondary">
                        {p.period}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Historial de pagos
        </h2>

        {!payments?.length ? (
          <p className="mt-3 text-sm text-text-secondary">
            No hay pagos registrados
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {payments.map((payment, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-1 rounded-lg bg-surface-input border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-text-primary">
                    ${Number(payment.amount).toLocaleString("es-AR")}
                  </span>

                  {payment.plan_name && (
                    <span className="text-xs text-text-secondary">
                      {payment.plan_name}
                    </span>
                  )}

                  <span className="text-xs text-text-secondary">
                    {payment.payment_method === "cash"
                      ? "Efectivo"
                      : payment.payment_method === "transfer"
                        ? "Transferencia"
                        : "Tarjeta"}
                  </span>
                </div>

                <span className="text-sm text-text-secondary">
                  {formatHumanDate(payment.paid_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberPayments;
