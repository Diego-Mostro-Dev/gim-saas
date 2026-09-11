import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { formatLongDate } from "../../utils/date.utils";
import { getPublicRecoveries } from "../../services/recoveries.service";

const STATUS_LABELS = {
  scheduled: "Programada",
  available: "Disponible",
  used: "Usada",
  cancelled: "Cancelada",
  expired: "Vencida",
};

const STATUS_CLASS = {
  scheduled: "bg-info-bg dark:bg-info/15 text-info-text dark:text-info",
  available: "bg-success-bg dark:bg-success/15 text-success-text dark:text-success",
  used: "bg-info-bg dark:bg-info/15 text-info-text dark:text-info",
  cancelled: "bg-surface-input text-text-secondary",
  expired: "bg-surface-input text-text-secondary",
};

function formatPlanned(recovery) {
  const { status, used_date: usedDate, used_hour: usedHour } = recovery;
  if (!usedDate) return null;
  const hour = usedHour ? ` a las ${usedHour}` : "";
  if (status === "scheduled") {
    return `Planificada para el ${formatLongDate(usedDate)}${hour}`;
  }
  if (status === "used") {
    return `Usada el ${formatLongDate(usedDate)}${hour}`;
  }
  if (status === "expired") {
    return `Era para el ${formatLongDate(usedDate)}${hour}. No se usó.`;
  }
  return null;
}

function MemberRecoveries() {
  const { token } = useOutletContext();

  const [recoveries, setRecoveries] = useState([]);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    let active = true;

    async function load() {
      setStatus("loading");
      try {
        const data = await getPublicRecoveries(token);
        if (!active) return;
        setRecoveries(data);
        setStatus("success");
      } catch (err) {
        console.error(err);
        if (!active) return;
        setStatus("error");
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Mis recuperaciones
        </h2>

        <p className="mt-1 text-xs text-text-secondary">
          Cuando faltás a una clase o sesión, el gym puede otorgarte una
          recuperación de la misma clase para otro día. La recuperación es tu
          asistencia de ese día. Si tu actividad es con paquete de sesiones, se
          descuenta 1 sesión de tu paquete.
        </p>

        {status === "loading" ? (
          <p className="mt-3 text-sm text-text-secondary">Cargando...</p>
        ) : status === "error" ? (
          <p className="mt-3 text-sm text-danger-text dark:text-danger">
            No se pudieron cargar las recuperaciones.
          </p>
        ) : recoveries.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">
            No tenés recuperaciones otorgadas.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {recoveries.map((recovery) => (
              <div
                key={recovery.id}
                className="rounded-lg bg-surface-input border border-border px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {recovery.kind_label}
                      {recovery.activity_name && (
                        <> · {recovery.activity_name}</>
                      )}
                    </p>

                    <p className="text-xs text-text-secondary">
                      {!["available", "cancelled"].includes(recovery.status) &&
                        formatPlanned(recovery)}
                    </p>

                    {recovery.note && (
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {recovery.note}
                      </p>
                    )}
                  </div>

                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      STATUS_CLASS[recovery.status] || "bg-surface-input text-text-secondary"
                    }`}
                  >
                    {STATUS_LABELS[recovery.status] || recovery.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberRecoveries;