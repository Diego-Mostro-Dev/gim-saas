import { useOutletContext } from "react-router-dom";

function formatDate(date) {
  return new Date(date).toLocaleDateString("es-AR");
}

function MemberPayments() {
  const { routine } = useOutletContext();
  const { payments } = routine;

  if (!payments?.length) {
    return (
      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Historial de pagos
        </h2>
        <p className="mt-3 text-sm text-text-secondary">
          No hay pagos registrados
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Historial de pagos
        </h2>

        <div className="space-y-2">
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
                {formatDate(payment.paid_at)}
              </span>
            </div>
          ))}
        </div>
    </div>
  );
}

export default MemberPayments;
