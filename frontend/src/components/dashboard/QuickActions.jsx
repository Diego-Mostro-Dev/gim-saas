import {
  UserPlus,
  CreditCard,
  RefreshCw,
  QrCode,
  Dumbbell,
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
          Agregar Miembro
        </span>
      </button>

      <button
        onClick={() => navigate("/subscriptions")}
        className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 transition active:scale-95"
      >
        <CreditCard size={18} className="text-pink-300" />

        <span className="whitespace-nowrap text-sm text-white">
          Registrar Pago
        </span>
      </button>

      <button
        onClick={() => navigate("/subscriptions?create=true")}
        className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 transition active:scale-95"
      >
        <RefreshCw size={18} className="text-pink-300" />

        <span className="whitespace-nowrap text-sm text-white">
          Crear Suscripción
        </span>
      </button>

      <button
        onClick={() => navigate("/registration")}
        className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 transition active:scale-95"
      >
        <QrCode size={18} className="text-pink-300" />

        <span className="whitespace-nowrap text-sm text-white">Registro</span>
      </button>

      <button
        onClick={() => navigate("/checkin-qr")}
        className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 transition active:scale-95"
      >
        <CheckCircle size={18} className="text-green-400" />

        <span className="whitespace-nowrap text-sm text-white">
          QR Asistencia
        </span>
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
