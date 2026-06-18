import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { RefreshCw, ArrowLeftRight } from "lucide-react";
import toast from "react-hot-toast";

import {
  getPublicSlots,
  createPublicScheduleChangeRequest,
  cancelPublicScheduleChangeRequest,
  createPublicScheduleSwapRequest,
  cancelPublicScheduleSwapRequest,
} from "../services/routines.service";
import { DAY_NAMES, DAY_ORDER } from "../constants/days";
import { formatHumanDate } from "../utils/date.utils";

function PublicRoutine() {
  const { routine, token, refreshRoutine, slots, changeRequests, swapRequests } =
    useOutletContext();

  const [showModal, setShowModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTarget, setSwapTarget] = useState(null);
  const [swapDate, setSwapDate] = useState("");
  const [swapSlotId, setSwapSlotId] = useState("");
  const [submittingSwap, setSubmittingSwap] = useState(false);
  const [swapDateSlots, setSwapDateSlots] = useState([]);
  const [showAllChanges, setShowAllChanges] = useState(false);
  const [showSwapHistory, setShowSwapHistory] = useState(false);

  function openChangeModal(schedule) {
    setSelectedSchedule(schedule);
    setSelectedSlotId("");
    setShowModal(true);
  }

  useEffect(() => {
    if (swapDate && token) {
      getPublicSlots(token, swapDate).then(setSwapDateSlots).catch(() => {});
    } else {
      setSwapDateSlots([]);
    }
  }, [swapDate, token]);

  function openSwapModal(schedule) {
    setSwapTarget(schedule);
    setSwapDate("");
    setSwapSlotId("");
    setShowSwapModal(true);
  }

  async function handleCreateSwap() {
    if (!swapDate || !swapSlotId) return;

    try {
      setSubmittingSwap(true);

      await createPublicScheduleSwapRequest(token, {
        origin_schedule: swapTarget.id,
        destination_slot: Number(swapSlotId),
        swap_date: swapDate,
      });

      toast.success("Intercambio solicitado correctamente");

      setShowSwapModal(false);
      setSwapTarget(null);
      setSwapDate("");
      setSwapSlotId("");

      await refreshRoutine();
    } catch (error) {
      const msg = error?.data?.[0] || error?.message || "Error al enviar la solicitud";
      toast.error(msg);
    } finally {
      setSubmittingSwap(false);
    }
  }

  async function handleCreateRequest() {
    if (!selectedSlotId) return;

    try {
      setSubmitting(true);

      await createPublicScheduleChangeRequest(token, {
        current_schedule: selectedSchedule.id,
        requested_slot: Number(selectedSlotId),
      });

      toast.success("Solicitud enviada correctamente");

      setShowModal(false);
      setSelectedSchedule(null);
      setSelectedSlotId("");

      await refreshRoutine();
    } catch (error) {
      const msg = error?.data?.[0] || error?.message || "Error al enviar la solicitud";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelRequest(id) {
    try {
      await cancelPublicScheduleChangeRequest(token, id);
      toast.success("Solicitud cancelada");
      await refreshRoutine();
    } catch (error) {
      toast.error("Error al cancelar la solicitud");
    }
  }

  async function handleCancelSwap(id) {
    try {
      await cancelPublicScheduleSwapRequest(token, id);
      toast.success("Solicitud cancelada");
      await refreshRoutine();
    } catch (error) {
      toast.error("Error al cancelar la solicitud");
    }
  }

  const { schedules, gym } = routine;

  const occupiedSlots = new Set(
    (schedules || []).map((s) => `${s.day}|${s.hour}`),
  );

  const availableSlots = selectedSchedule
    ? slots.filter((s) => !occupiedSlots.has(`${s.day}|${s.hour}`))
    : [];

  const uniqueDays = [...new Set(availableSlots.map((s) => s.day))].sort(
    (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
  );

  const slotsForDay = selectedDay
    ? availableSlots.filter((s) => s.day === selectedDay)
    : [];

  const swapAvailableSlots = swapTarget
    ? slots.filter((s) => !occupiedSlots.has(`${s.day}|${s.hour}`))
    : [];

  function dayNameFromDate(dateStr) {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return days[new Date(dateStr + "T12:00:00").getDay()];
  }

  const slotsForSwapDate = swapDate
    ? (swapDateSlots.length > 0 ? swapDateSlots : swapAvailableSlots)
        .filter((s) => s.day === dayNameFromDate(swapDate))
        .filter((s) => !occupiedSlots.has(`${s.day}|${s.hour}`))
    : [];

  const minSwapDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  const swapDateHasActiveRequest = swapDate && swapRequests.some(
    (r) => r.swap_date === swapDate && r.status !== "cancelled"
  );

  const todayStr = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  const upcomingSwaps = swapRequests
    .filter((r) => r.status === "approved" && r.swap_date >= todayStr)
    .sort((a, b) => a.swap_date.localeCompare(b.swap_date));

  const pendingSwaps = swapRequests.filter((r) => r.status === "pending");

  const swapHistory = swapRequests.filter(
    (r) => r.status === "rejected" || r.status === "cancelled" || (r.status === "approved" && r.swap_date < todayStr)
  );

  function getSlotDayLabel(dayKey) {
    return DAY_NAMES[dayKey] || dayKey;
  }

  return (
    <div className="space-y-4">
      {/* HORARIOS */}
      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Horarios permanentes
        </h2>

        {schedules?.length > 0 ? (
          <div className="space-y-2">
            {schedules.map((schedule, idx) => {
              const hasPending = changeRequests.some(
                (r) => r.current_schedule === schedule.id && r.status === "pending"
              );
              return (
                <div
                  key={schedule.id || idx}
                  className="rounded-xl bg-surface-input px-4 py-3"
                >
                  <div className={gym.allow_member_schedule_changes && gym.allow_schedule_changes !== false ? "mb-2" : ""}>
                    <span className="text-base font-semibold text-text-primary">
                      {DAY_NAMES[schedule.day] || schedule.day}
                    </span>
                    <span className="ml-1.5 text-base font-semibold text-text-primary">
                      {schedule.hour}
                    </span>
                  </div>
                  {gym.allow_member_schedule_changes && gym.allow_schedule_changes !== false && (
                    <div className="flex flex-wrap gap-2">
                      {!hasPending && (
                        <button
                          onClick={() => openChangeModal(schedule)}
                          className="inline-flex items-center gap-1 rounded-lg bg-info-bg px-2.5 py-1.5 text-xs font-medium text-info-text dark:bg-info/15 dark:text-info transition hover:bg-info/30"
                        >
                          <RefreshCw size={14} />
                          Cambio permanente
                        </button>
                      )}
                      <button
                        onClick={() => openSwapModal(schedule)}
                        className="inline-flex items-center gap-1 rounded-lg bg-info-bg px-2.5 py-1.5 text-xs font-medium text-info-text dark:bg-info/15 dark:text-info transition hover:bg-info/30"
                      >
                        <ArrowLeftRight size={14} />
                        Intercambio
                      </button>
                      {hasPending && (
                        <span className="inline-flex items-center rounded-lg bg-warning-bg dark:bg-warning/15 px-2.5 py-1.5 text-xs font-medium text-warning-text dark:text-warning">
                          Pendiente
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Sin horarios asignados</p>
        )}
      </div>

      {/* SOLICITUDES DE CAMBIO */}
      {gym.allow_member_schedule_changes && gym.allow_schedule_changes !== false && changeRequests.length > 0 && (
        <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Cambios permanentes
            </h2>

            {changeRequests.filter(r => r.status !== "pending").length > 0 && (
              <button
                onClick={() => setShowAllChanges(!showAllChanges)}
                className="text-xs text-info-text dark:text-info transition hover:text-info/80"
              >
                {showAllChanges
                  ? "Mostrar solo pendientes"
                  : `Ver historial (${changeRequests.filter(r => r.status !== "pending").length})`}
              </button>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {(showAllChanges ? changeRequests : changeRequests.filter(r => r.status === "pending")).map((req) => (
              <div
                key={req.id}
                className="rounded-xl bg-surface-input px-4 py-3"
              >
                <p className="text-xs text-text-secondary">Próximo horario</p>

                <p className="mt-0.5 text-sm text-text-primary">
                  {DAY_NAMES[req.requested_day]}{" "}
                    {req.effective_date ? formatHumanDate(req.effective_date) : ""}
                  ,{" "}
                  {req.effective_date
                    ? new Date(req.effective_date).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </p>

                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className={`rounded-lg px-2 py-0.5 text-xs font-medium ${
                      req.status === "pending"
                        ? "bg-warning-bg dark:bg-warning/15 text-warning-text dark:text-warning"
                        : req.status === "approved"
                          ? "bg-success-bg dark:bg-success/15 text-success-text dark:text-success"
                          : req.status === "rejected"
                            ? "bg-danger-bg dark:bg-danger/15 text-danger-text dark:text-danger"
                            : "bg-muted-bg text-muted-text"
                    }`}
                  >
                    {req.status === "pending"
                      ? "⏳ Pendiente"
                      : req.status === "approved"
                        ? "✓ Aprobado"
                        : req.status === "rejected"
                          ? "✕ Rechazado"
                          : "Cancelado"}
                  </span>
                </div>

                {req.status === "pending" && (
                  <button
                    onClick={() => handleCancelRequest(req.id)}
                    className="mt-2 text-xs text-danger-text dark:text-danger transition hover:text-danger-text dark:hover:text-danger"
                  >
                    Cancelar solicitud
                  </button>
                )}

                {req.admin_notes && (
                  <p className="mt-1 text-xs text-text-secondary">
                    {req.admin_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRÓXIMOS INTERCAMBIOS */}
      {gym.allow_member_schedule_changes && gym.allow_schedule_changes !== false && upcomingSwaps.length > 0 && (
        <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Próximos intercambios
          </h2>

          <div className="space-y-2">
            {upcomingSwaps.map((req) => (
              <div
                key={req.id}
                className="rounded-xl bg-surface-input px-4 py-3"
              >
                <p className="text-sm font-semibold text-text-primary">
                  {formatHumanDate(req.swap_date)}
                </p>

                <p className="mt-0.5 text-xs text-text-secondary">
                  {DAY_NAMES[req.origin_day]} {req.origin_hour} → {DAY_NAMES[req.destination_day]} {req.destination_hour}
                </p>

                <div className="mt-2">
                  <span className="rounded-lg bg-success-bg dark:bg-success/15 px-2 py-0.5 text-xs font-medium text-success-text dark:text-success">
                    ✅ Aprobado
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SOLICITUDES PENDIENTES */}
      {gym.allow_member_schedule_changes && gym.allow_schedule_changes !== false && pendingSwaps.length > 0 && (
        <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Solicitudes pendientes
          </h2>

          <div className="space-y-2">
            {pendingSwaps.map((req) => (
              <div
                key={req.id}
                className="rounded-xl bg-surface-input px-4 py-3"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-secondary">
                      {DAY_NAMES[req.origin_day]} {req.origin_hour} → {DAY_NAMES[req.destination_day]} {req.destination_hour}
                    </p>

                    <p className="mt-0.5 text-sm text-text-primary">
                      {formatHumanDate(req.swap_date)}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-lg bg-warning-bg dark:bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-text dark:text-warning">
                    ⏳ Pendiente
                  </span>
                </div>

                <button
                  onClick={() => handleCancelSwap(req.id)}
                  className="mt-2 text-xs text-danger-text dark:text-danger transition hover:text-danger-text dark:hover:text-danger"
                >
                  Cancelar solicitud
                </button>

                {req.admin_notes && (
                  <p className="mt-1 text-xs text-text-secondary">
                    {req.admin_notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HISTORIAL DE INTERCAMBIOS */}
      {gym.allow_member_schedule_changes && gym.allow_schedule_changes !== false && swapHistory.length > 0 && (
        <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Historial
            </h2>

            <button
              onClick={() => setShowSwapHistory(!showSwapHistory)}
              className="text-xs text-info-text dark:text-info transition hover:text-info/80"
            >
              {showSwapHistory
                ? "Ocultar historial"
                : `Ver historial (${swapHistory.length})`}
            </button>
          </div>

          {showSwapHistory && (
            <div className="mt-3 space-y-2">
              {swapHistory.map((req) => (
                <div
                  key={req.id}
                  className="rounded-xl bg-surface-input px-4 py-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-text-secondary">
                        {DAY_NAMES[req.origin_day]} {req.origin_hour} → {DAY_NAMES[req.destination_day]} {req.destination_hour}
                      </p>

                      <p className="mt-0.5 text-sm text-text-primary">
                        {formatHumanDate(req.swap_date)}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium ${
                        req.status === "approved"
                          ? "bg-success-bg dark:bg-success/15 text-success-text dark:text-success"
                          : req.status === "rejected"
                            ? "bg-danger-bg dark:bg-danger/15 text-danger-text dark:text-danger"
                            : "bg-muted-bg text-muted-text"
                      }`}
                    >
                      {req.status === "approved"
                        ? "✅ Aprobado"
                        : req.status === "rejected"
                          ? "❌ Rechazado"
                          : "🚫 Cancelado"}
                    </span>
                  </div>

                  {req.admin_notes && (
                    <p className="mt-1 text-xs text-text-secondary">
                      {req.admin_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL SOLICITAR CAMBIO */}
      {showModal && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-surface-elevated p-6 sm:rounded-2xl shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">
                Solicitar cambio permanente
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-text-secondary transition hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-surface-input p-3">
              <p className="text-xs text-text-secondary">Horario actual</p>
              <p className="text-sm text-text-primary">
                {DAY_NAMES[selectedSchedule.day] || selectedSchedule.day} {selectedSchedule.hour}
              </p>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm text-text-secondary">Nuevo día</label>
              <select
                value={selectedDay}
                onChange={(e) => {
                  setSelectedDay(e.target.value);
                  setSelectedSlotId("");
                }}
                className="w-full rounded-xl bg-surface-input px-3 py-2.5 text-sm text-text-primary"
              >
                <option value="">Seleccionar día</option>
                {uniqueDays.map((day) => (
                  <option key={day} value={day}>
                    {getSlotDayLabel(day)}
                  </option>
                ))}
              </select>
            </div>

            {selectedDay && (
              <div className="mb-6">
                <label className="mb-2 block text-sm text-text-secondary">Nuevo horario</label>
                <div className="grid grid-cols-2 gap-2">
                  {slotsForDay.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        Number(selectedSlotId) === slot.id
                          ? "bg-info text-white"
                          : "bg-surface-input text-text-secondary hover:bg-surface-elevated"
                      }`}
                    >
                      {slot.hour}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl bg-surface-input px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-elevated"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateRequest}
                disabled={!selectedSlotId || submitting}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CAMBIAR SOLO ESTA FECHA */}
      {showSwapModal && swapTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-surface-elevated p-6 sm:rounded-2xl shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">
                Intercambiar por única vez
              </h3>
              <button
                onClick={() => setShowSwapModal(false)}
                className="text-text-secondary transition hover:text-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-surface-input p-3">
              <p className="text-xs text-text-secondary">Horario actual</p>
              <p className="text-sm text-text-primary">
                {DAY_NAMES[swapTarget.day] || swapTarget.day} {swapTarget.hour}
              </p>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm text-text-secondary">Fecha</label>
              <input
                type="date"
                value={swapDate}
                min={minSwapDate}
                onChange={(e) => {
                  setSwapDate(e.target.value);
                  setSwapSlotId("");
                }}
                className="w-full rounded-xl bg-surface-input px-3 py-2.5 text-sm text-text-primary"
              />
            </div>

            {swapDate && swapDateHasActiveRequest && (
              <div className="mb-4 rounded-xl bg-warning-bg dark:bg-warning/15 px-4 py-3 text-sm text-warning-text dark:text-warning">
                Ya tienes una solicitud de intercambio pendiente para esta fecha.
              </div>
            )}

            {swapDate && !swapDateHasActiveRequest && (
              <div className="mb-6">
                <label className="mb-2 block text-sm text-text-secondary">Nuevo horario</label>
                {slotsForSwapDate.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {slotsForSwapDate.map((slot) => {
                      const occ = slot.occupancy;
                      const cap = slot.capacity;
                      const full = occ !== undefined && cap !== null && occ >= cap;

                      return (
                        <button
                          key={slot.id}
                          onClick={() => !full && setSwapSlotId(slot.id)}
                          disabled={full}
                          className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            Number(swapSlotId) === slot.id
                              ? "bg-info text-white"
                              : full
                                ? "bg-surface-input text-danger-text dark:text-danger cursor-not-allowed"
                                : "bg-surface-input text-text-secondary hover:bg-surface-elevated"
                          }`}
                        >
                          <div>{slot.hour}</div>
                          {occ !== undefined && (
                            <div className={`mt-0.5 text-[10px] ${full ? "text-danger-text dark:text-danger" : "text-text-secondary"}`}>
                              {full ? "Completo" : `${occ}/${cap}`}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">No hay horarios disponibles para esta fecha.</p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowSwapModal(false)}
                className="flex-1 rounded-xl bg-surface-input px-4 py-2.5 text-sm font-medium text-text-secondary transition hover:bg-surface-elevated"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateSwap}
                disabled={!swapDate || !swapSlotId || submittingSwap || swapDateHasActiveRequest}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {submittingSwap ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PublicRoutine;
