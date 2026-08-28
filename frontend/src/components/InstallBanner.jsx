import { useState } from "react";
import { Download, Menu, Share, X } from "lucide-react";
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

function GuideSheet({ title, children, onClose }) {
  return (
    <div className="fixed inset-x-0 bottom-24 z-[100] flex justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/10 bg-surface-modal px-4 py-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text-primary">{title}</p>
            <div className="mt-2 text-xs text-text-secondary">{children}</div>
          </div>
          <button
            onClick={onClose}
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

export default function InstallBanner() {
  const { canInstall, installed, isIOS, isAndroid, isStandalone, promptInstall } =
    usePWAInstall();
  const [dismissedForever, setDismissedForever] = useState(isDismissedForever);
  const [sessionHidden, setSessionHidden] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  if (isStandalone || installed || dismissedForever || sessionHidden) {
    return null;
  }

  const actions = (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
      >
        {isIOS ? "Guía" : "Instalar"}
      </button>
      <button
        onClick={() => setConfirmDismiss(true)}
        className="shrink-0 text-text-secondary transition hover:text-text-primary"
        aria-label="Ocultar"
      >
        <X size={18} />
      </button>
    </>
  );

  const dismissOrActions = confirmDismiss ? (
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
    actions
  );

  if (isIOS) {
    if (showGuide) {
      return (
        <GuideSheet
          title="Para instalarla en tu iPhone"
          onClose={() => setShowGuide(false)}
        >
          <ol className="list-decimal space-y-1 pl-4">
            <li className="pl-1">
              Tocá el botón{" "}
              <span className="mx-0.5 inline-flex h-5 w-5 translate-y-0.5 items-center justify-center rounded">
                <Share size={14} />
              </span>{" "}
              de tu navegador (Compartir).
            </li>
            <li className="pl-1">
              Elegí{" "}
              <span className="font-medium text-text-primary">
                &quot;Añadir a pantalla de inicio&quot;
              </span>
              .
            </li>
            <li className="pl-1">Confirmá y listo, queda instalada.</li>
          </ol>
        </GuideSheet>
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
          {dismissOrActions}
        </div>
      </div>
    );
  }

  if (!canInstall && !isAndroid) {
    return null;
  }

  if (showGuide) {
    return (
      <GuideSheet
        title={canInstall ? "Instalar la aplicación" : "Cómo instalarla en Android"}
        onClose={() => setShowGuide(false)}
      >
        {canInstall ? (
          <>
            <p>
              Tocá{" "}
              <button
                onClick={promptInstall}
                className="font-medium text-primary"
              >
                Instalar
              </button>{" "}
              en la barra para instalarla ahora.
            </p>
            <p className="mt-1 text-text-tertiary">
              Si no aparece, usá el menú ⋮ del navegador.
            </p>
          </>
        ) : (
          <ol className="list-decimal space-y-1 pl-4">
            <li className="pl-1">
              Abrí el menú de Chrome con los tres puntos{" "}
              <span className="mx-0.5 inline-flex h-5 w-5 translate-y-0.5 items-center justify-center rounded">
                <Menu size={14} />
              </span>{" "}
              arriba a la derecha.
            </li>
            <li className="pl-1">
              Elegí{" "}
              <span className="font-medium text-text-primary">
                &quot;Instalar aplicación&quot;
              </span>{" "}
              (verás el ícono del gimnasio).
            </li>
            <li className="pl-1">Confirmá y listo.</li>
          </ol>
        )}
      </GuideSheet>
    );
  }

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
        {dismissOrActions}
      </div>
    </div>
  );
}