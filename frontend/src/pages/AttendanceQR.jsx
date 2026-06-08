import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as QRModule from "react-qr-code";
import { ArrowLeft, Download } from "lucide-react";

import { useGym } from "../hooks/useGym";

const QRCode = QRModule.QRCode || QRModule.default?.QRCode;

function AttendanceQR() {
  const navigate = useNavigate();
  const { gym } = useGym();

  const qrRef = useRef(null);

  function handleDownload() {
    const svg = qrRef.current?.querySelector("svg");

    if (!svg) return;

    const originalSvg = new XMLSerializer().serializeToString(svg);

    const wrappedSvg = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="500"
        height="500"
        viewBox="-4 -4 41 41"
      >
        <rect
          x="-4"
          y="-4"
          width="41"
          height="41"
          fill="white"
        />
        ${originalSvg.replace(/<svg[^>]*>/, "<g>").replace("</svg>", "</g>")}
      </svg>
    `;

    const blob = new Blob([wrappedSvg], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `${gym.slug}-attendance-qr.svg`;

    link.click();

    URL.revokeObjectURL(url);
  }

  if (!gym) {
    return <div className="p-4 text-white">Cargando...</div>;
  }

  const checkinUrl = `${window.location.origin}/checkin/${gym.onboarding_code}`;

  return (
    <div className="flex min-h-full flex-col items-center p-6 text-white">
      <div className="mb-4 self-start">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
        >
          <ArrowLeft size={18} />
          Volver al inicio
        </button>
      </div>

      <h1 className="mb-2 text-2xl font-semibold">Check-In de Asistencia</h1>

      <p className="mb-6 max-w-md text-center text-sm text-zinc-400">
        Mostrá este QR en una pantalla o imprimilo en recepción. Los socios
        deberán abrir su Portal del Socio y escanear este código para registrar
        automáticamente su asistencia.
      </p>

      {QRCode && (
        <div ref={qrRef} className="max-w-full rounded-3xl bg-white p-5 shadow-lg">
          <QRCode
            value={checkinUrl}
            size={320}
            bgColor="#FFFFFF"
            fgColor="#000000"
            style={{ maxWidth: "100%", height: "auto" }}
          />
        </div>
      )}

      <div className="mt-6 w-full max-w-md rounded-2xl border border-white/10 bg-[#201f1f] p-4">
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
          URL de Check-In
        </p>

        <p className="break-all text-sm text-zinc-300">{checkinUrl}</p>

        <button
          onClick={handleDownload}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-white transition active:scale-95"
        >
          <Download size={18} />
          Descargar QR
        </button>
      </div>
    </div>
  );
}

export default AttendanceQR;
