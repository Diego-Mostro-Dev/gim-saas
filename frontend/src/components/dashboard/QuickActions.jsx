import {
  UserPlus,
  CreditCard,
  RefreshCw,
} from "lucide-react";

function QuickActions() {
  return (
    <section className="flex gap-3 overflow-x-auto pb-2">
      <button className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 active:scale-95">
        <UserPlus size={18} className="text-pink-300" />

        <span className="whitespace-nowrap text-sm text-white">
          Agregar Miembro
        </span>
      </button>

      <button className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 active:scale-95">
        <CreditCard size={18} className="text-pink-300" />

        <span className="whitespace-nowrap text-sm text-white">
          Registrar Pago
        </span>
      </button>

      <button className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/5 bg-[#201f1f] px-4 py-3 active:scale-95">
        <RefreshCw size={18} className="text-pink-300" />

        <span className="whitespace-nowrap text-sm text-white">
          Crear Suscripción
        </span>
      </button>
    </section>
  );
}

export default QuickActions;