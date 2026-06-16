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
      <div className="w-full max-w-md rounded-3xl border border-border/10 bg-surface-modal p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-danger/10 p-3 text-danger">
              <AlertTriangle size={22} />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-text-primary">{title}</h2>

              <p className="mt-1 text-sm text-text-secondary">{message}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-text-secondary transition hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-border/10 px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-input"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-text-primary transition brightness-100 hover:brightness-90"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
