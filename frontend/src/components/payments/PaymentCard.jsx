import { Pencil, Trash2 } from "lucide-react";

function PaymentCard({ payment, onEdit, onDelete }) {
  const paymentMethodLabels = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <p className="font-medium text-text-primary">{payment.member_name}</p>

        <p className="text-sm text-text-secondary">
          {paymentMethodLabels[payment.payment_method] ||
            payment.payment_method}
        </p>

        <p className="text-xs text-text-secondary">{payment.notes || "Sin notas"}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="rounded-md border border-success/20 bg-success-bg dark:bg-success/15 px-2 py-1 text-xs text-success-text dark:text-success">
          ${payment.amount}
        </div>

        <button
          onClick={() => onEdit(payment)}
          className="rounded-lg bg-primary/10 p-2 text-primary transition hover:bg-primary/20"
        >
          <Pencil size={16} />
        </button>

        <button
          onClick={() => onDelete(payment.id)}
            className="rounded-lg bg-danger-bg dark:bg-danger/15 p-2 text-danger-text dark:text-danger transition hover:bg-danger-bg dark:hover:bg-danger/20"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default PaymentCard;
