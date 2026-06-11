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
        className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 transition active:scale-95"
      >
        <UserPlus size={18} className="text-pink-300" />

        <span className="whitespace-nowrap text-sm text-white">
          Agregar miembro
        </span>
      </button>

      <button
        onClick={() => navigate("/payments")}
        className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 transition active:scale-95"
      >
        <CreditCard size={18} className="text-pink-300" />

        <span className="whitespace-nowrap text-sm text-white">
          Registrar pago
        </span>
      </button>

      <button
        onClick={() => navigate("/subscriptions?create=true")}
        className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 transition active:scale-95"
      >
        <RefreshCw size={18} className="text-pink-300" />

        <span className="whitespace-nowrap text-sm text-white">
          Crear suscripción
        </span>
      </button>

      <button
        onClick={() => navigate("/attendance")}
        className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 transition active:scale-95"
      >
        <CheckCircle size={18} className="text-green-400" />

        <span className="whitespace-nowrap text-sm text-white">
          Marcar asistencia
        </span>
      </button>

      <button
        onClick={() => navigate("/payments")}
        className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 transition active:scale-95"
      >
        <DollarSign size={18} className="text-green-400" />

        <span className="whitespace-nowrap text-sm text-white">Ver pagos</span>
      </button>

      <button
        onClick={() => navigate("/routines")}
        className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 transition active:scale-95"
      >
        <Dumbbell size={18} className="text-pink-300" />

        <span className="whitespace-nowrap text-sm text-white">Rutinas</span>
      </button>
    </section>
  );
}

export default QuickActions;
