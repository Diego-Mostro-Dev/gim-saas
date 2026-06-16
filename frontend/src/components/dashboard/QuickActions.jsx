import {
  UserPlus,
  CreditCard,
  RefreshCw,
  QrCode,
  Dumbbell,
  DollarSign,
  CheckCircle,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

function QuickActions() {
  const navigate = useNavigate();

  return (
    <section className="flex gap-3 overflow-x-auto pb-2">
      <button
        onClick={() => navigate("/members?create=true")}
        className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-3 shadow-sm transition active:scale-95"
      >
        <UserPlus size={18} className="text-blue-400" />

        <span className="whitespace-nowrap text-sm text-text-primary">
          Agregar miembro
        </span>
      </button>

      <button
        onClick={() => navigate("/payments")}
        className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-3 shadow-sm transition active:scale-95"
      >
        <CreditCard size={18} className="text-blue-400" />

        <span className="whitespace-nowrap text-sm text-text-primary">
          Registrar pago
        </span>
      </button>

      <button
        onClick={() => navigate("/subscriptions?create=true")}
        className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-3 shadow-sm transition active:scale-95"
      >
        <RefreshCw size={18} className="text-blue-400" />

        <span className="whitespace-nowrap text-sm text-text-primary">
          Crear suscripción
        </span>
      </button>

      <button
        onClick={() => navigate("/attendance")}
        className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-3 shadow-sm transition active:scale-95"
      >
        <CheckCircle size={18} className="text-success-text dark:text-success" />

        <span className="whitespace-nowrap text-sm text-text-primary">
          Marcar asistencia
        </span>
      </button>

      <button
        onClick={() => navigate("/payments")}
        className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-3 shadow-sm transition active:scale-95"
      >
        <DollarSign size={18} className="text-success-text dark:text-success" />

        <span className="whitespace-nowrap text-sm text-text-primary">Ver pagos</span>
      </button>

      <button
        onClick={() => navigate("/routines")}
        className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-3 shadow-sm transition active:scale-95"
      >
        <Dumbbell size={18} className="text-blue-400" />

        <span className="whitespace-nowrap text-sm text-text-primary">Rutinas</span>
      </button>
    </section>
  );
}

export default QuickActions;
