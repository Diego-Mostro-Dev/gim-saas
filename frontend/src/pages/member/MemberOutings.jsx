import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  Footprints,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import toast from "react-hot-toast";

import { DAY_NAMES } from "../../constants/days";
import { getPublicOutings } from "../../services/outingsPublic.service";

function MemberOutings() {
  const { token } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carga inicial deliberada (fetch-on-mount): patrón usado en toda la codebase.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    async function load() {
      try {
        const result = await getPublicOutings(token);
        setData(result);
      } catch (err) {
        toast.error(err.message || "Error al cargar tus salidas");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center text-sm text-text-secondary">
        Cargando tus salidas…
      </div>
    );
  }

  const outings = data?.outings || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-surface-input px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
          <Footprints size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-text-primary">
            Salidas / Running grupal
          </h2>
          <p className="text-xs text-text-secondary">
            {data?.gym_name || "Tu gimnasio"} · {outings.length}{" "}
            {outings.length === 1 ? "grupo" : "grupos"}
          </p>
        </div>
      </div>

      {outings.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center">
          <Footprints size={28} className="mx-auto text-text-secondary" />
          <p className="mt-2 text-sm text-text-primary">
            Todavía no formás parte de ningún grupo de salidas.
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Cuando el staff te inscriba, vas a ver acá tu grupo, el horario y
            con quién sales.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {outings.map((outing) => {
            const isPackage = outing.modality === "package";
            const exhausted = outing.exhausted;
            return (
              <div
                key={outing.id}
                className="rounded-xl border border-border bg-surface-elevated p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary">
                      {outing.outing}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      Trainer: {outing.trainer_name || "Por asignar"}
                    </p>
                    {outing.meeting_place && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                        <MapPin size={12} />
                        {outing.meeting_place}
                      </p>
                    )}
                    {(outing.trainer_whatsapp ||
                      outing.trainer_phone ||
                      outing.trainer_email) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {outing.trainer_whatsapp && (
                          <a
                            href={`https://wa.me/${String(
                              outing.trainer_whatsapp,
                            ).replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Contactar al trainer por WhatsApp"
                            className="inline-flex items-center gap-1 rounded-md bg-success-bg px-1.5 py-0.5 text-[10px] font-medium text-success-text dark:bg-success/15 dark:text-success transition hover:underline"
                          >
                            <MessageCircle size={11} />
                            {outing.trainer_whatsapp}
                          </a>
                        )}
                        {outing.trainer_phone && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface-input px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                            <Phone size={11} />
                            {outing.trainer_phone}
                          </span>
                        )}
                        {outing.trainer_email && (
                          <a
                            href={`mailto:${outing.trainer_email}`}
                            className="inline-flex items-center gap-1 rounded-md bg-surface-input px-1.5 py-0.5 text-[10px] font-medium text-info-text dark:text-info transition hover:underline"
                          >
                            <Mail size={11} />
                            {outing.trainer_email}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="flex items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
                    <CalendarDays size={13} />
                    {DAY_NAMES[outing.day]} ·{" "}
                    {String(outing.start_time).slice(0, 5)}–
                    {String(outing.end_time).slice(0, 5)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      isPackage
                        ? "bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
                        : "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning"
                    }`}
                  >
                    {isPackage ? "Paquete" : "Mensual"}
                  </span>

                  {outing.duration_minutes > 60 && (
                    <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                      <Clock size={12} />
                      ~{outing.duration_minutes} min
                    </span>
                  )}

                  {isPackage && (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-input">
                        <div
                          className={`h-full rounded-full ${
                            exhausted ? "bg-danger-text dark:bg-danger" : "bg-blue-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              ((outing.sessions_used || 0) /
                                (outing.sessions_total || 1)) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-text-secondary">
                        {outing.sessions_used}/{outing.sessions_total} sesiones
                      </span>
                    </div>
                  )}

                  {exhausted && (
                    <span className="rounded-md bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger-text dark:bg-danger/15 dark:text-danger">
                      Paquete agotado
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MemberOutings;