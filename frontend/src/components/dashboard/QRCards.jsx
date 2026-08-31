import * as QRModule from "react-qr-code";
import { QrCode, UserPlus } from "lucide-react";

import { useGym } from "../../hooks/useGym";

const QRCode = QRModule.QRCode || QRModule.default?.QRCode;

function QRCards() {
  const { gym } = useGym();

  if (!gym?.onboarding_code) {
    return null;
  }

  const registerUrl = gym.register_url || `${window.location.origin}/register/${gym.onboarding_code}`;
  const checkinUrl = `${window.location.origin}/checkin/${gym.onboarding_code}`;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Códigos QR
        </h2>
        <p className="text-xs text-text-secondary">
          Apuntá la cámara para escanear
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <QRCard
          title="Registro de miembros"
          message={gym.qr_registration_message}
          url={registerUrl}
          Icon={UserPlus}
          accent="text-blue-400"
        />

        <QRCard
          title="Check-in de asistencia"
          message={gym.qr_attendance_message}
          url={checkinUrl}
          Icon={QrCode}
          accent="text-success-text dark:text-success"
        />
      </div>
    </section>
  );
}

function QRCard({ title, message, url, Icon, accent }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={18} className={accent} />
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>

      <div className="rounded-2xl bg-white p-3 shadow-inner ring-1 ring-black/5">
        {QRCode && (
          <QRCode
            value={url}
            size={224}
            level="H"
            bgColor="#FFFFFF"
            fgColor="#000000"
            style={{ width: "100%", height: "auto", maxWidth: "224px" }}
          />
        )}
      </div>

      {message && (
        <p className="mt-3 text-center text-sm font-medium text-text-primary">
          {message}
        </p>
      )}
    </div>
  );
}

export default QRCards;
