import { Pencil, Trash2 } from "lucide-react";

function PaymentCard({ payment, onEdit, onDelete }) {
  const paymentMethodLabels = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-[#201f1f] p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="font-medium text-white">{payment.member_name}</p>

        <p className="text-sm text-zinc-400">
          {paymentMethodLabels[payment.payment_method] ||
            payment.payment_method}
        </p>

        <p className="text-xs text-zinc-500">{payment.notes || "Sin notas"}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="rounded-md bg-green-500/10 px-2 py-1 text-xs text-green-300">
          ${payment.amount}
        </div>

        <button
          onClick={() => onEdit(payment)}
          className="rounded-lg bg-blue-500/10 p-2 text-blue-300 transition hover:bg-blue-500/20"
        >
          <Pencil size={16} />
        </button>

        <button
          onClick={() => onDelete(payment.id)}
          className="rounded-lg bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default PaymentCard;
