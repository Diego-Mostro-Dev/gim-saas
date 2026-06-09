function PaymentStats({
  totalAmount,
  totalPayments,
  cashPayments,
  transferPayments,
}) {
  return (
    <section className="mb-6 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
      <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
        <p className="text-sm text-zinc-400">Total recaudado</p>

        <h3 className="mt-2 text-2xl font-bold text-white">
          ${totalAmount.toLocaleString("es-AR")}
        </h3>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
        <p className="text-sm text-zinc-400">Pagos registrados</p>

        <h3 className="mt-2 text-2xl font-bold text-white">{totalPayments}</h3>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
        <p className="text-sm text-zinc-400">Efectivo</p>

        <h3 className="mt-2 text-2xl font-bold text-green-300">
          {cashPayments}
        </h3>
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4">
        <p className="text-sm text-zinc-400">Transferencia</p>

        <h3 className="mt-2 text-2xl font-bold text-blue-300">
          {transferPayments}
        </h3>
      </div>
    </section>
  );
}

export default PaymentStats;
