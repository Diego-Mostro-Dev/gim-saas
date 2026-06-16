function PaymentStats({
  totalAmount,
  totalPayments,
  cashPayments,
  transferPayments,
}) {
  return (
    <section className="mb-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <p className="text-sm text-text-secondary">Total recaudado</p>

        <h3 className="mt-2 text-2xl font-bold text-text-primary">
          ${totalAmount.toLocaleString("es-AR")}
        </h3>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <p className="text-sm text-text-secondary">Pagos registrados</p>

        <h3 className="mt-2 text-2xl font-bold text-text-primary">{totalPayments}</h3>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <p className="text-sm text-text-secondary">Efectivo</p>

        <h3 className="mt-2 text-2xl font-bold text-success-text dark:text-success">
          {cashPayments}
        </h3>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <p className="text-sm text-text-secondary">Transferencia</p>

        <h3 className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-300">
          {transferPayments}
        </h3>
      </div>
    </section>
  );
}

export default PaymentStats;
