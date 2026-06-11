import { useOutletContext } from "react-router-dom";

function formatDate(date) {
  return new Date(date).toLocaleDateString("es-AR");
}

function MemberPayments() {
  const { routine } = useOutletContext();
  const { payments } = routine;

  if (!payments?.length) {
    return (
      <div className="rounded-2xl bg-[#201f1f] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Historial de pagos
        </h2>
        <p className="mt-3 text-sm text-zinc-500">
          No hay pagos registrados
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#201f1f] p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Historial de pagos
        </h2>

        <div className="space-y-2">
          {payments.map((payment, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-1 rounded-xl bg-[#2a2a2a] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-white">
                  ${Number(payment.amount).toLocaleString("es-AR")}
                </span>

                {payment.plan_name && (
                  <span className="text-xs text-zinc-500">
                    {payment.plan_name}
                  </span>
                )}

                <span className="text-xs text-zinc-500">
                  {payment.payment_method === "cash"
                    ? "Efectivo"
                    : payment.payment_method === "transfer"
                      ? "Transferencia"
                      : "Tarjeta"}
                </span>
              </div>

              <span className="text-sm text-zinc-400">
                {formatDate(payment.paid_at)}
              </span>
            </div>
          ))}
        </div>
    </div>
  );
}

export default MemberPayments;
