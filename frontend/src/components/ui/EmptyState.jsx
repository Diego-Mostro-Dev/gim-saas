export default function EmptyState({ message }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm text-text-secondary shadow-sm">
      {message}
    </div>
  );
}
