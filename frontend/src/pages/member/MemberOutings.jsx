import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  Footprints,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Route,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { DAY_NAMES } from "../../constants/days";
import OutingRouteMap from "../../components/outings/OutingRouteMap";
import {
  cancelPublicOutingEnrollmentRequest,
  createPublicOutingEnrollmentRequest,
  getPublicOutings,
} from "../../services/outingsPublic.service";

const REQUEST_STATUS = {
  pending: { label: "Pendiente", cls: "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning" },
  approved: { label: "Aprobada", cls: "bg-success-bg text-success-text dark:bg-success/15 dark:text-success" },
  rejected: { label: "Rechazada", cls: "bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger" },
  cancelled_by_member: { label: "Cancelada", cls: "bg-muted-bg text-muted-text" },
  cancelled_by_staff: { label: "Cancelada", cls: "bg-muted-bg text-muted-text" },
};

function MemberOutings() {
  const { token } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null);
  const cancelledRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const result = await getPublicOutings(token);
      if (!cancelledRef.current) setData(result);
    } catch (err) {
      if (!cancelledRef.current) {
        toast.error(err.message || "Error al cargar tus salidas");
      }
    }
  }, [token]);

  // Carga inicial deliberada (fetch-on-mount): patrón usado en toda la codebase.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    cancelledRef.current = false;
    setLoading(true);
    load().finally(() => {
      if (!cancelledRef.current) setLoading(false);
    });
    return () => {
      cancelledRef.current = true;
    };
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  async function runAction(nextAction, fn, successMessage) {
    setAction(nextAction);
    try {
      await fn();
      toast.success(successMessage);
      await load();
    } catch (err) {
      toast.error(err.message || "Error al enviar la solicitud");
    } finally {
      setAction(null);
    }
  }

  function handleEnroll(scheduleId) {
    runAction(
      { type: "enroll", id: scheduleId },
      () =>
        createPublicOutingEnrollmentRequest(token, {
          request_type: "enroll",
          schedule_id: scheduleId,
        }),
      "Solicitud de inscripción enviada. El staff debe aprobarla.",
    );
  }

  function handleUnenroll(enrollmentId) {
    runAction(
      { type: "unenroll", id: enrollmentId },
      () =>
        createPublicOutingEnrollmentRequest(token, {
          request_type: "unenroll",
          enrollment_id: enrollmentId,
        }),
      "Solicitud de baja enviada. El staff debe aprobarla.",
    );
  }

  function handleCancelRequest(requestId) {
    runAction(
      { type: "cancel", id: requestId },
      () => cancelPublicOutingEnrollmentRequest(token, requestId),
      "Solicitud cancelada.",
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center text-sm text-text-secondary">
        Cargando tus salidas…
      </div>
    );
  }

  const outings = data?.outings || [];
  const available = data?.available_outings || [];
  const requests = data?.requests || [];

  const pendingUnenroll = requests.find(
    (r) => r.request_type === "unenroll" && r.status === "pending",
  );
  const busyOn = (type, id) => action?.type === type && action?.id === id;

  function requestBadgeType(requestType) {
    return (
      <span
        className={`rounded-md px-2 py-0.5 text-xs font-medium ${
          requestType === "enroll"
            ? "bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
            : "bg-danger-bg text-danger-text dark:bg-danger/15 dark:text-danger"
        }`}
      >
        {requestType === "enroll" ? "Inscripción" : "Baja"}
      </span>
    );
  }

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
                    {outing.route_distance_km && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-text-secondary">
                        <Route size={12} className="text-primary" />
                        Recorrido ~
                        {Number(outing.route_distance_km).toLocaleString(
                          "es-AR",
                          { maximumFractionDigits: 2 },
                        )}{" "}
                        km
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

                {Array.isArray(outing.route_polyline) &&
                  outing.route_polyline.length >= 2 && (
                    <div className="mt-3">
                      <OutingRouteMap polyline={outing.route_polyline} />
                    </div>
                  )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => handleUnenroll(outing.id)}
                    disabled={
                      Boolean(pendingUnenroll) ||
                      busyOn("unenroll", outing.id)
                    }
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-danger-bg px-3 py-2 text-sm font-medium text-danger-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-danger/15 dark:text-danger dark:hover:bg-danger/30"
                  >
                    {busyOn("unenroll", outing.id) ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <UserMinus size={16} />
                    )}
                    Solicitar baja
                  </button>
                  {pendingUnenroll && (
                    <span className="text-xs text-text-secondary">
                      Tenés una solicitud de baja pendiente.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {available.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-elevated p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <UserPlus size={16} className="text-primary" />
            Grupos disponibles para sumarte
          </h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            Enviá la solicitud y el staff la aprobará.
          </p>

          <div className="mt-3 space-y-3">
            {available.map((g) => (
              <div
                key={g.id}
                className="rounded-xl bg-surface-input p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary">{g.name}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      Trainer: {g.trainer_name || "Por asignar"}
                    </p>
                    {g.meeting_place && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                        <MapPin size={12} />
                        {g.meeting_place}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-2 space-y-2">
                  {g.schedules.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-elevated px-3 py-2"
                    >
                      <span className="text-xs text-text-secondary">
                        {DAY_NAMES[s.day]} · {s.start_time}–{s.end_time} ·{" "}
                        {s.available_spots}{" "}
                        {s.available_spots === 1 ? "cupo libre" : "cupos libres"}
                      </span>
                      <button
                        onClick={() => handleEnroll(s.id)}
                        disabled={busyOn("enroll", s.id)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-success px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyOn("enroll", s.id) ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <UserPlus size={14} />
                        )}
                        Solicitar inscripción
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-elevated p-4">
          <h3 className="text-sm font-semibold text-text-primary">
            Solicitudes
          </h3>
          <div className="mt-3 space-y-2">
            {requests.map((r) => {
              const status = REQUEST_STATUS[r.status] || {
                label: r.status,
                cls: "bg-muted-bg text-muted-text",
              };
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-input px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {requestBadgeType(r.request_type)}
                      <span className="font-medium text-text-primary">
                        {r.outing_name || "Salida"}
                      </span>
                      {r.day && (
                        <span className="text-xs text-text-secondary">
                          {DAY_NAMES[r.day]} · {String(r.start_time).slice(0, 5)}
                        </span>
                      )}
                    </div>
                    {r.admin_notes && (
                      <p className="mt-0.5 text-xs text-text-secondary">
                        Nota: {r.admin_notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${status.cls}`}
                    >
                      {status.label}
                    </span>
                    {r.status === "pending" && (
                      <button
                        onClick={() => handleCancelRequest(r.id)}
                        disabled={busyOn("cancel", r.id)}
                        className="flex items-center gap-1 rounded-xl border border-border px-2 py-1 text-xs text-text-secondary transition hover:bg-surface-input disabled:opacity-50"
                      >
                        {busyOn("cancel", r.id) ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <X size={12} />
                        )}
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default MemberOutings;