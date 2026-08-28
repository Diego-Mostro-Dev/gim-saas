import { useState } from "react";
import { Download, Share, X } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

const IOS_HINT_KEY = "__pwa_ios_hint_dismissed__";

function getIosHintDismissed() {
  try {
    return localStorage.getItem(IOS_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function persistIosHintDismissed() {
  try {
    localStorage.setItem(IOS_HINT_KEY, "1");
  } catch {
    /* ignore */
  }
}

export default function InstallBanner() {
  const { canInstall, installed, isIOS, isStandalone, promptInstall } =
    usePWAInstall();
  const [iosHintDismissed, setIosHintDismissed] = useState(getIosHintDismissed);
  const [androidDismissed, setAndroidDismissed] = useState(false);

  if (isStandalone || installed) return null;

  if (canInstall && !androidDismissed) {
    return (
      <div className="fixed inset-x-0 bottom-24 z-[100] flex justify-center px-4">
        <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-border/10 bg-surface-modal px-4 py-3 shadow-2xl backdrop-blur-xl">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Download size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">
              Instalar la aplicación
            </p>
            <p className="truncate text-xs text-text-secondary">
              Acceso rápido desde tu pantalla de inicio
            </p>
          </div>
          <button
            onClick={promptInstall}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
          >
            Instalar
          </button>
          <button
            onClick={() => setAndroidDismissed(true)}
            className="shrink-0 text-text-secondary transition hover:text-text-primary"
            aria-label="Ocultar"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (isIOS && !iosHintDismissed) {
    return (
      <div className="fixed inset-x-0 bottom-24 z-[100] flex justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border/10 bg-surface-modal px-4 py-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Share size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">
                Añadir a pantalla de inicio
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Tocá el botón{" "}
                <span className="mx-0.5 inline-flex h-5 w-5 translate-y-1 items-center justify-center rounded text-[10px]">
                  <Share size={14} />
                </span>{" "}
                de tu navegador y elegí{" "}
                <span className="font-medium text-text-primary">
                  &quot;Añadir a pantalla de inicio&quot;
                </span>
                .
              </p>
            </div>
            <button
              onClick={() => {
                setIosHintDismissed(true);
                persistIosHintDismissed();
              }}
              className="shrink-0 text-text-secondary transition hover:text-text-primary"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}