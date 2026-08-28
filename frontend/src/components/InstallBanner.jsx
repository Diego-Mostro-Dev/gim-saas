import { useState } from "react";
import { Download, Share, X } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

const INSTALL_DISMISS_KEY = "__pwa_install_dismissed__";

function isDismissedForever() {
  try {
    return localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissForever() {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

function DismissOptions({ onForever, onLater }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        onClick={onForever}
        className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
      >
        No mostrar más
      </button>
      <button
        onClick={onLater}
        className="rounded-lg px-2.5 py-1.5 text-xs text-text-secondary transition hover:text-text-primary"
      >
        Ahora no
      </button>
    </div>
  );
}

export default function InstallBanner() {
  const { canInstall, installed, isIOS, isStandalone, promptInstall } =
    usePWAInstall();
  const [dismissedForever, setDismissedForever] = useState(isDismissedForever);
  const [sessionHidden, setSessionHidden] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (isStandalone || installed || dismissedForever || sessionHidden) {
    return null;
  }

  if (canInstall) {
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
          {confirmDismiss ? (
            <DismissOptions
              onForever={() => {
                dismissForever();
                setDismissedForever(true);
              }}
              onLater={() => {
                setConfirmDismiss(false);
                setSessionHidden(true);
              }}
            />
          ) : (
            <>
              <button
                onClick={promptInstall}
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
              >
                Instalar
              </button>
              <button
                onClick={() => setConfirmDismiss(true)}
                className="shrink-0 text-text-secondary transition hover:text-text-primary"
                aria-label="Ocultar"
              >
                <X size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (isIOS) {
    if (showIosGuide) {
      return (
        <div className="fixed inset-x-0 bottom-24 z-[100] flex justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-border/10 bg-surface-modal px-4 py-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Share size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">
                  Para instalarla en tu iPhone
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-text-secondary">
                  <li className="pl-1">Tocá el botón{" "}
                    <span className="mx-0.5 inline-flex h-5 w-5 translate-y-0.5 items-center justify-center rounded">
                      <Share size={14} />
                    </span>{" "}
                    de tu navegador (Compartir).
                  </li>
                  <li className="pl-1">Elegí{" "}
                    <span className="font-medium text-text-primary">
                      &quot;Añadir a pantalla de inicio&quot;
                    </span>.
                  </li>
                  <li className="pl-1">Confirmá y listo, queda instalada.</li>
                </ol>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
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

    return (
      <div className="fixed inset-x-0 bottom-24 z-[100] flex justify-center px-4">
        <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-border/10 bg-surface-modal px-4 py-3 shadow-2xl backdrop-blur-xl">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Share size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">
              Añadir a pantalla de inicio
            </p>
            <p className="truncate text-xs text-text-secondary">
              Usá la app desde tu iPhone sin navegador
            </p>
          </div>
          {confirmDismiss ? (
            <DismissOptions
              onForever={() => {
                dismissForever();
                setDismissedForever(true);
              }}
              onLater={() => {
                setConfirmDismiss(false);
                setSessionHidden(true);
              }}
            />
          ) : (
            <>
              <button
                onClick={() => setShowIosGuide(true)}
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
              >
                Guía
              </button>
              <button
                onClick={() => setConfirmDismiss(true)}
                className="shrink-0 text-text-secondary transition hover:text-text-primary"
                aria-label="Ocultar"
              >
                <X size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}