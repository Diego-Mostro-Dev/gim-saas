import { ArrowLeft, Copy, Check, Printer } from "lucide-react";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as QRModule from "react-qr-code";

import { useGym } from "../hooks/useGym";
import { printQrA4 } from "../utils/qrPrint";

const QRCode = QRModule.QRCode || QRModule.default?.QRCode;

function Registration() {
  const navigate = useNavigate();
  const { gym } = useGym();

  const [copied, setCopied] = useState(false);

  const qrRef = useRef(null);

  async function handleCopy() {
    if (!gym?.register_url) return;

    await navigator.clipboard.writeText(gym.register_url);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  function handlePrint() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    printQrA4({
      gymName: gym?.name,
      message: gym?.qr_registration_message,
      qrSvg: new XMLSerializer().serializeToString(svg),
    });
  }

  if (!gym) {
    return <div className="p-4 text-text-primary">Cargando...</div>;
  }

  return (
    <div className="flex min-h-full flex-col items-center p-6 text-text-primary">
      <div className="mb-4 self-start">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 rounded-lg border border-border/10 px-3 py-2 text-sm text-text-primary transition hover:bg-surface-input"
        >
          <ArrowLeft size={18} />
          Volver al inicio
        </button>
      </div>

      <h1 className="mb-2 text-2xl font-semibold">Registro de miembros</h1>

      <p className="mb-6 text-center text-sm text-text-secondary">
        Escaneá este código para registrarte en{" "}
        <span className="font-medium text-text-primary">{gym.name}</span>
      </p>

      {QRCode && (
        <div className="flex flex-col items-center gap-4">
          <div
            ref={qrRef}
            className="max-w-full rounded-3xl bg-white p-5 shadow-lg ring-1 ring-black/5"
          >
            <QRCode
              value={gym.register_url}
              size={320}
              level="H"
              bgColor="#FFFFFF"
              fgColor="#000000"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </div>

          {gym.qr_registration_message && (
            <p className="text-center text-lg font-semibold text-text-primary">
              {gym.qr_registration_message}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 w-full max-w-md rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <p className="mb-2 text-xs uppercase tracking-wide text-text-secondary">
          Enlace de registro
        </p>

        <p className="break-all text-sm text-text-primary">{gym.register_url}</p>

        <button
          onClick={handleCopy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-white transition active:scale-95"
        >
          {copied ? (
            <>
              <Check size={18} />
              Copiado
            </>
          ) : (
            <>
              <Copy size={18} />
              Copiar enlace
            </>
          )}
        </button>

        <button
          onClick={handlePrint}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border/10 px-4 py-3 text-text-primary transition active:scale-95"
        >
          <Printer size={18} />
          Imprimir QR en A4
        </button>
      </div>
    </div>
  );
}

export default Registration;
