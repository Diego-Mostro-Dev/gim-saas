import { useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";

const options = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const CurrentIcon =
    options.find((o) => o.value === theme)?.icon || Monitor;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-border/10 p-2 text-text-secondary transition hover:bg-surface-input"
        aria-label="Cambiar tema"
      >
        <CurrentIcon size={18} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-36 rounded-xl border border-border bg-surface-elevated p-1 shadow-2xl">
            {options.map((opt) => {
              const OptIcon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    setTheme(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    theme === opt.value
                      ? "bg-primary/10 text-primary"
                      : "text-text-secondary hover:bg-surface-input"
                  }`}
                >
                  <OptIcon size={16} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
