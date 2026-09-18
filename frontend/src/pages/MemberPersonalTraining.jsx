import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Dumbbell,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import { DAY_NAMES, DAY_ORDER } from "../constants/days";
import { formatCurrency } from "../utils/currency.utils";
import {
  cancelPublicPersonalTrainingChangeRequest,
  createPublicPersonalTrainingChangeRequest,
  getPublicPersonalTraining,
  getPublicPersonalTrainingAvailableSlots,
} from "../services/personalTraining.service";
import {
  dayIntervals,
  endHoursFor,
  isFree,
  reconcileSlot,
  startHoursFor,
} from "../utils/ptAvailability";

const STATUS_LABELS = {
  pending: "Pendiente de aprobación",
  executed: "Aprobado",
  rejected: "Rechazado",
  cancelled_by_member: "Cancelado",
  cancelled_by_staff: "Cancelado",
};

const inputClass =
  "w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring";

function MemberPersonalTraining() {
  const { token, isOperativeBlocked } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [request, setRequest] = useState({
    requested_day: "monday",
    requested_start_time: "08:00",
    requested_end_time: "09:00",
  });
  const [freeData, setFreeData] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  async function load(force = false) {
    if (force) setLoading(true);
    try {
      const result = await getPublicPersonalTraining(token);
      setData(result);
    } catch (err) {
      toast.error(err.message || "Error al cargar el entrenamiento personal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  function pickAssignment(assignment) {
    setEditingAssignment(assignment);
    setRequest({
      requested_day: assignment.day,
      requested_start_time: String(assignment.start_time).slice(0, 5),
      requested_end_time: String(assignment.end_time).slice(0, 5),
    });
    setFreeData(null);
    setSlotsLoading(true);
    getPublicPersonalTrainingAvailableSlots(token, assignment.id)
      .then((res) => {
        setFreeData(res);
        setRequest((r) => {
          const fixed = reconcileSlot(
            res,
            r.requested_day,
            r.requested_start_time,
            r.requested_end_time,
          );
          if (
            fixed.start === r.requested_start_time &&
            fixed.end === r.requested_end_time
          ) {
            return r;
          }
          return {
            ...r,
            requested_start_time: fixed.start,
            requested_end_time: fixed.end,
          };
        });
      })
      .catch((err) => {
        toast.error(err.message || "Error al cargar horarios disponibles");
        setFreeData({ days: {}, closed_days: [] });
      })
      .finally(() => setSlotsLoading(false));
  }

  function dayUnavailable(day) {
    if (!freeData) return false;
    return (
      freeData.closed_days?.includes(day) ||
      dayIntervals(freeData, day).length === 0
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!editingAssignment) return;
    if (isOperativeBlocked) {
      toast.error("No disponible por falta de pago");
      return;
    }
    if (request.requested_end_time <= request.requested_start_time) {
      toast.error("La hora de fin debe ser posterior a la de inicio");
      return;
    }
    const intervals = dayIntervals(freeData, request.requested_day);
    if (!intervals.length || !isFree(intervals, request.requested_start_time, request.requested_end_time)) {
      toast.error("Ese horario ya no está disponible. Elegí otro de la lista.");
      return;
    }
    setSubmitting(true);
    try {
      await createPublicPersonalTrainingChangeRequest(token, {
        assignment_id: editingAssignment.id,
        requested_day: request.requested_day,
        requested_start_time: request.requested_start_time,
        requested_end_time: request.requested_end_time,
      });
      toast.success("Solicitud de cambio enviada");
      setEditingAssignment(null);
      await load(true);
    } catch (err) {
      toast.error(err.message || "Error al enviar la solicitud");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id) {
    if (isOperativeBlocked) return;
    setCancellingId(id);
    try {
      await cancelPublicPersonalTrainingChangeRequest(token, id);
      toast.success("Solicitud cancelada");
      await load();
    } catch (err) {
      toast.error(err.message || "Error al cancelar la solicitud");
    } finally {
      setCancellingId(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center text-sm text-text-secondary">
        Cargando tu entrenamiento personal…
      </div>
    );
  }

  const assignments = data?.personal_training || [];
  const changeRequests = data?.change_requests || [];
  const pendingRequests = changeRequests.filter(
    (r) => r.status === "pending",
  );
  const dayIv = dayIntervals(freeData, request.requested_day);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-surface-input px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
          <Dumbbell size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-text-primary">
            Entrenamiento personal
          </h2>
          <p className="text-xs text-text-secondary">
            {data?.gym_name || "Tu entrenamiento"} · {assignments.length}{" "}
            asignaci{assignments.length === 1 ? "ón" : "ones"}
          </p>
        </div>
      </div>

      {isOperativeBlocked && (
        <div className="rounded-xl border border-danger/20 bg-danger-bg/20 dark:bg-danger/10 px-4 py-3 text-xs text-danger-text dark:text-danger">
          No podés solicitar cambios de horario por falta de pago.
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center">
          <ShieldCheck size={28} className="mx-auto text-text-secondary" />
          <p className="mt-2 text-sm text-text-primary">
            Aún no tenés entrenamiento personal asignado.
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Cuando el gimnasio te asigne un horario, aparecerá acá.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const isPackage = assignment.modality === "package";
            const exhausted = assignment.exhausted;
            return (
              <div
                key={assignment.id}
                className="rounded-xl border border-border bg-surface-elevated p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary">
                      {assignment.service_name}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      Trainer: {assignment.trainer_name}
                      {assignment.member_address
                        ? ` · ${assignment.member_address}`
                        : ""}
                    </p>
                    {(assignment.trainer_whatsapp ||
                      assignment.trainer_phone ||
                      assignment.trainer_email) && (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {assignment.trainer_whatsapp && (
                          <a
                            href={`https://wa.me/${String(
                              assignment.trainer_whatsapp
                            ).replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Contactar al trainer por WhatsApp"
                            className="inline-flex items-center gap-1 rounded-md bg-success-bg px-1.5 py-0.5 text-[10px] font-medium text-success-text dark:bg-success/15 dark:text-success transition hover:underline"
                          >
                            <MessageCircle size={11} />
                            {assignment.trainer_whatsapp}
                          </a>
                        )}
                        {assignment.trainer_phone && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface-input px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                            <Phone size={11} />
                            {assignment.trainer_phone}
                          </span>
                        )}
                        {assignment.trainer_email && (
                          <a
                            href={`mailto:${assignment.trainer_email}`}
                            className="inline-flex items-center gap-1 rounded-md bg-surface-input px-1.5 py-0.5 text-[10px] font-medium text-info-text dark:text-info transition hover:underline"
                          >
                            <Mail size={11} />
                            {assignment.trainer_email}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="flex items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
                    <CalendarDays size={13} />
                    {DAY_NAMES[assignment.day]} ·{" "}
                    {String(assignment.start_time).slice(0, 5)}–
                    {String(assignment.end_time).slice(0, 5)}
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
                              ((assignment.sessions_used || 0) /
                                (assignment.sessions_total || 1)) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-text-secondary">
                        {assignment.sessions_used}/{assignment.sessions_total}{" "}
                        sesiones
                      </span>
                    </div>
                  )}

                  {exhausted && (
                    <span className="rounded-md bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger-text dark:bg-danger/15 dark:text-danger">
                      Paquete agotado
                    </span>
                  )}

                  {assignment.sellado_amount > 0 && (
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        assignment.sellado_paid
                          ? "bg-success-bg text-success-text dark:bg-success/15 dark:text-success"
                          : "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning"
                      }`}
                    >
                      Sellado{" "}
                      {assignment.sellado_paid
                        ? "pagado"
                        : formatCurrency(assignment.sellado_amount)}
                    </span>
                  )}

                  {isPackage &&
                    Number(assignment.amount_paid) > 0 &&
                    !exhausted && (
                      <span className="text-xs text-text-secondary">
                        Pagado {formatCurrency(assignment.amount_paid)}
                      </span>
                    )}
                </div>

                <button
                  onClick={() => pickAssignment(assignment)}
                  disabled={isOperativeBlocked}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Clock size={15} />
                  Solicitar cambio de horario
                </button>
              </div>
            );
          })}
        </div>
      )}

      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Solicitudes pendientes
          </h3>
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-warning/20 bg-warning-bg/50 dark:bg-warning/5 p-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-sm text-warning-text dark:text-warning">
                  <Clock size={14} />
                  {DAY_NAMES[req.requested_day]} ·{" "}
                  {String(req.requested_start_time).slice(0, 5)}–
                  {String(req.requested_end_time).slice(0, 5)}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Esperando aprobación del gimnasio
                </p>
              </div>
              <button
                onClick={() => handleCancel(req.id)}
                disabled={cancellingId === req.id || isOperativeBlocked}
                className="flex shrink-0 items-center gap-1 rounded-lg border border-danger/30 px-2.5 py-1.5 text-xs text-danger-text dark:text-danger transition hover:bg-danger/10 disabled:opacity-50"
              >
                <X size={13} />
                Cancelar
              </button>
            </div>
          ))}
        </div>
      )}

      {changeRequests.some((r) => r.status !== "pending") && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Historial
          </h3>
          {changeRequests
            .filter((r) => r.status !== "pending")
            .map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-3"
              >
                <CheckCircle2 size={16} className="shrink-0 text-text-secondary" />
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">
                    {DAY_NAMES[req.requested_day]} ·{" "}
                    {String(req.requested_start_time).slice(0, 5)}–
                    {String(req.requested_end_time).slice(0, 5)}
                  </p>
                  <p
                    className={`mt-0.5 text-xs ${
                      req.status === "executed"
                        ? "text-success-text dark:text-success"
                        : "text-text-secondary"
                    }`}
                  >
                    {STATUS_LABELS[req.status] || req.status}
                    {req.admin_notes ? ` · ${req.admin_notes}` : ""}
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}

      {editingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl bg-surface-elevated p-4 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text-primary">
                Cambiar horario de{" "}
                {editingAssignment.service_name}
              </h3>
              <button
                onClick={() => setEditingAssignment(null)}
                className="rounded-lg p-2 text-text-secondary transition hover:bg-surface-input"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-2 text-xs text-text-secondary">
              El gimnasio revisará tu solicitud y confirmará el nuevo horario.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {slotsLoading ? (
                <p className="rounded-xl bg-surface-input px-4 py-3 text-xs text-text-secondary">
                  Cargando horarios disponibles…
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      Día
                    </label>
                    <select
                      value={request.requested_day}
                      onChange={(e) => {
                        const day = e.target.value;
                        setRequest((r) => {
                          const fixed = reconcileSlot(
                            freeData,
                            day,
                            r.requested_start_time,
                            r.requested_end_time,
                          );
                          return {
                            ...r,
                            requested_day: day,
                            requested_start_time: fixed.start,
                            requested_end_time: fixed.end,
                          };
                        });
                      }}
                      className={inputClass}
                    >
                      {DAY_ORDER.map((day) => (
                        <option
                          key={day}
                          value={day}
                          disabled={dayUnavailable(day)}
                        >
                          {DAY_NAMES[day]}
                          {dayUnavailable(day)
                            ? freeData?.closed_days?.includes(day)
                              ? " · gym cerrado"
                              : " · sin horarios libres"
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Inicio
                      </label>
                      <select
                        value={request.requested_start_time}
                        onChange={(e) => {
                          const nextStart = e.target.value;
                          const ends = endHoursFor(dayIv, nextStart);
                          if (ends.includes(request.requested_end_time)) {
                            setRequest({
                              ...request,
                              requested_start_time: nextStart,
                            });
                          } else {
                            setRequest({
                              ...request,
                              requested_start_time: nextStart,
                              requested_end_time: ends[0] || "",
                            });
                          }
                        }}
                        className={inputClass}
                      >
                        {request.requested_end_time && dayIv.length > 0 ? (
                          startHoursFor(dayIv)
                            .filter((h) => h < request.requested_end_time)
                            .map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))
                        ) : (
                          <option value="" disabled>
                            Sin horarios
                          </option>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-text-secondary">
                        Fin
                      </label>
                      <select
                        value={request.requested_end_time}
                        onChange={(e) =>
                          setRequest({
                            ...request,
                            requested_end_time: e.target.value,
                          })
                        }
                        className={inputClass}
                      >
                        {request.requested_start_time && dayIv.length > 0 ? (
                          endHoursFor(
                            dayIv,
                            request.requested_start_time,
                          ).map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>
                            Sin horarios
                          </option>
                        )}
                      </select>
                    </div>
                  </div>
                  {dayIv.length === 0 ? (
                    <p className="text-xs text-danger-text dark:text-danger">
                      No hay horarios libres este día. Elegí otro día de la
                      lista.
                    </p>
                  ) : (
                    <p className="text-xs text-text-secondary">
                      Solo se muestran horarios que no chocan con tus clases,
                      tu gim común ni el resto de asignaciones. Tu horario
                      actual siempre figura como disponible.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAssignment(null)}
                  className="rounded-xl border border-border px-4 py-2 text-sm text-text-primary transition hover:bg-surface-input"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || slotsLoading}
                  className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                >
                  {submitting
                    ? "Enviando…"
                    : slotsLoading
                      ? "Cargando…"
                      : "Enviar solicitud"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemberPersonalTraining;