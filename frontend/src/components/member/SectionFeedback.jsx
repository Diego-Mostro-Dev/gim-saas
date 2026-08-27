export function StaleDataNotice({ message, onRetry, retrying = false }) {
  return (
    <div className="rounded-xl bg-warning-bg dark:bg-warning/15 px-4 py-3 text-xs text-warning-text dark:text-warning">
      <p>
        {message ||
          "No pudimos actualizar esta información. Se muestran los últimos datos disponibles."}
        {onRetry && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="ml-2 font-semibold underline underline-offset-2 disabled:opacity-50"
          >
            {retrying ? "Actualizando..." : "Reintentar"}
          </button>
        )}
      </p>
    </div>
  );
}

export function LoadErrorNotice({ message, onRetry, retrying = false }) {
  return (
    <div className="rounded-xl bg-warning-bg dark:bg-warning/15 px-4 py-3 text-xs text-warning-text dark:text-warning">
      <p>{message || "No pudimos cargar esta información."}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="mt-2 font-semibold underline underline-offset-2 disabled:opacity-50"
        >
          {retrying ? "Actualizando..." : "Reintentar"}
        </button>
      )}
    </div>
  );
}

export function SectionSkeleton({ rows = 2 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-xl bg-surface-input" />
      ))}
    </div>
  );
}
