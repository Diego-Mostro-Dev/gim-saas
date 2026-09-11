import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CalendarCheck } from "lucide-react";
import { formatHumanDate } from "../../utils/date.utils";
import { getPublicRecoveries } from "../../services/recoveries.service";
import RecoveryCard from "../../components/recoveries/RecoveryCard";

function recoveryTimestamp(recovery) {
  if (recovery.used_date) {
    return `${recovery.used_date}T${recovery.used_hour || "00:00"}:00`;
  }
  return recovery.created_at || "";
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

  const ordered = useMemo(() => {
    const scheduled = recoveries
      .filter((r) => r.status === "scheduled")
      .sort((a, b) => recoveryTimestamp(a).localeCompare(recoveryTimestamp(b)));
    const used = recoveries
      .filter((r) => r.status === "used")
      .sort((a, b) => recoveryTimestamp(b).localeCompare(recoveryTimestamp(a)));
    const expired = recoveries.filter((r) => r.status === "expired");
    const cancelled = recoveries.filter((r) => r.status === "cancelled");

    return [...scheduled, ...used, ...expired, ...cancelled];
  }, [recoveries]);

  const nextRecovery = ordered[0]?.status === "scheduled" ? ordered[0] : null;

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
        ) : ordered.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-input px-4 py-8 text-center">
            <CalendarCheck size={28} className="text-text-secondary" />
            <p className="text-sm font-medium text-text-primary">
              No tenés recuperaciones otorgadas
            </p>
            <p className="text-xs text-text-secondary">
              Cuando falte a una clase, el gym puede otorgarte una recuperación
              y la vas a ver acá.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {nextRecovery && (
              <RecoveryCard
                recovery={nextRecovery}
                emphasize
                helper={
                  nextRecovery.used_date
                    ? `Mostrá tu QR el ${formatHumanDate(nextRecovery.used_date)}${
                        nextRecovery.used_hour
                          ? ` a las ${nextRecovery.used_hour}`
                          : ""
                      }.`
                    : null
                }
              />
            )}

            {ordered
              .filter((r) => r.id !== nextRecovery?.id)
              .map((recovery) => (
                <RecoveryCard
                  key={recovery.id}
                  recovery={recovery}
                  showGrantedMeta
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberRecoveries;