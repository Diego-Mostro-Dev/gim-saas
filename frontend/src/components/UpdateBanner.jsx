import { usePWAUpdate } from "../hooks/usePWAUpdate";

export default function UpdateBanner() {
  const {
    updateAvailable,
    offlineReady,
    isUpdating,
    currentBuildId,
    applyUpdate,
    dismissUpdate,
  } = usePWAUpdate();

  if (offlineReady && !updateAvailable) {
    return (
      <div className="fixed bottom-4 right-4 left-4 z-[100] flex max-w-sm flex-col items-start gap-2 rounded-xl border border-border/10 bg-surface-elevated px-4 py-3 shadow-lg backdrop-blur-xl sm:left-auto sm:flex-row sm:items-center sm:gap-3">
        <span className="text-xs text-success">
          App lista para uso offline
        </span>
      </div>
    );
  }

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 z-[100] flex max-w-sm flex-col items-start gap-3 rounded-xl border border-border/10 bg-surface-elevated px-4 py-3 shadow-lg backdrop-blur-xl sm:left-auto sm:flex-row sm:items-center">
      <div className="flex flex-col">
        <span className="text-sm text-text-primary">
          Nueva versión disponible
        </span>
        <span className="text-xs text-text-secondary">
          build: {currentBuildId}
        </span>
      </div>
      <button
        onClick={applyUpdate}
        disabled={isUpdating}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition ${
          isUpdating
            ? "cursor-not-allowed bg-primary/50"
            : "bg-primary hover:opacity-90"
        }`}
      >
        {isUpdating ? "Actualizando..." : "Actualizar ahora"}
      </button>
      <button
        onClick={dismissUpdate}
        disabled={isUpdating}
        className="text-xs text-text-secondary transition hover:text-text-primary disabled:opacity-40"
      >
        Más tarde
      </button>
    </div>
  );
}
