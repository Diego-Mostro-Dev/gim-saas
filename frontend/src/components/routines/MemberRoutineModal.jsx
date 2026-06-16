import { useState } from "react";
import { useMemberRoutine } from "../../hooks/useMemberRoutine";

function MemberRoutineModal({ open, onClose, routine }) {
  const { loadWhatsapp } = useMemberRoutine();

  const [sending, setSending] = useState(false);

  if (!open || !routine) return null;

  async function handleWhatsapp() {
    try {
      setSending(true);

      const data = await loadWhatsapp(routine.member_id);

      const phone = data.phone.replace(/\D/g, "");

      const url = `https://wa.me/54${phone}?text=${encodeURIComponent(
        data.message,
      )}`;

      window.open(url, "_blank");
    } catch (error) {
      console.error(error);

      alert("No se pudo generar el mensaje");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-surface-elevated p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-bold text-text-primary">
            {routine.routine_name}
          </h2>

          <button onClick={onClose} className="self-end text-text-secondary hover:text-text-primary md:self-auto">
            ✕
          </button>
        </div>

        <div className="mb-4">
          <button
            onClick={handleWhatsapp}
            disabled={sending}
            className="w-full rounded-xl bg-success py-3 font-medium text-white hover:bg-success/90 disabled:opacity-50"
          >
            {sending ? "Generando mensaje..." : "📲 Abrir WhatsApp"}
          </button>
        </div>

        <div className="space-y-3">
          {routine.exercises?.map((exercise) => (
            <div
              key={exercise.id}
              className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
            >
              <h3 className="font-medium text-text-primary">{exercise.name}</h3>

              <p className="text-sm text-text-secondary">
                {exercise.sets} series • {exercise.reps}
              </p>

              {exercise.weight && (
                <p className="text-sm text-info-text dark:text-info">Peso: {exercise.weight}</p>
              )}

              {exercise.notes && (
                <p className="mt-1 text-sm text-text-secondary">{exercise.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MemberRoutineModal;
