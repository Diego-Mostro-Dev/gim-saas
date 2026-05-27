import { X, AlertTriangle } from "lucide-react";

function ConfirmModal({
  isOpen,
  title = "Confirmar acción",
  message = "¿Estás seguro?",
  confirmText = "Eliminar",
  cancelText = "Cancelar",
  onConfirm,
  onClose,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1b1b1b] p-6 shadow-2xl">
        {/* HEADER */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-red-500/10 p-3 text-red-400">
              <AlertTriangle size={22} />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>

              <p className="mt-1 text-sm text-zinc-400">{message}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 transition hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* ACTIONS */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
