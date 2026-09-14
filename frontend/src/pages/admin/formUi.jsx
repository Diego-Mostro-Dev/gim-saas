export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-text-secondary">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-text-secondary">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-info";
export const selectCls =
  "rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-info";

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border border-border bg-surface-input text-blue-500"
      />
      <span>
        <span className="block text-sm text-text-primary">{label}</span>
        {hint && <span className="block text-xs text-text-secondary">{hint}</span>}
      </span>
    </label>
  );
}

export function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 space-y-4">
      {title && (
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}