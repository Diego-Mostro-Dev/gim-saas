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
import { DAY_NAMES } from "../constants/days";

function formatDate(date) {
  return new Date(date).toLocaleDateString("es-AR");
}

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
  const [showAllSwaps, setShowAllSwaps] = useState(false);

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

      toast.success("Solicitud de intercambio enviada correctamente");

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

  const uniqueDays = [...new Set(availableSlots.map((s) => s.day))];

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
    : [];

  function getSlotDayLabel(dayKey) {
    return DAY_NAMES[dayKey] || dayKey;
  }

  return (
    <div className="space-y-4">
      {/* HORARIOS */}
      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Horarios
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
                  <div className={gym.allow_member_schedule_changes ? "mb-2" : ""}>
                    <span className="text-base font-semibold text-text-primary">
                      {DAY_NAMES[schedule.day] || schedule.day}
                    </span>
                    <span className="ml-1.5 text-base font-semibold text-text-primary">
                      {schedule.hour}
                    </span>
                  </div>
                  {gym.allow_member_schedule_changes && (
                    <div className="flex flex-wrap gap-2">
                      {!hasPending && (
                        <button
                          onClick={() => openChangeModal(schedule)}
                          className="inline-flex items-center gap-1 rounded-lg bg-info-bg px-2.5 py-1.5 text-xs font-medium text-info-text dark:bg-info/15 dark:text-info transition hover:bg-info/30"
                        >
                          <RefreshCw size={14} />
                          Cambio
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
      {gym.allow_member_schedule_changes && changeRequests.length > 0 && (
        <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Solicitudes de cambio
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
                  {req.effective_date
                    ? new Date(req.effective_date).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : ""}
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

      {/* SOLICITUDES DE CAMBIO TEMPORAL */}
      {gym.allow_member_schedule_changes && swapRequests.length > 0 && (
        <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Intercambios de día
            </h2>

            {swapRequests.filter(r => r.status !== "pending").length > 0 && (
              <button
                onClick={() => setShowAllSwaps(!showAllSwaps)}
                className="text-xs text-info-text dark:text-info transition hover:text-info/80"
              >
                {showAllSwaps
                  ? "Mostrar solo pendientes"
                  : `Ver historial (${swapRequests.filter(r => r.status !== "pending").length})`}
              </button>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {(showAllSwaps ? swapRequests : swapRequests.filter(r => r.status === "pending")).map((req) => (
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
                      {new Date(req.swap_date).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium ${
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
                        ? "✅ Aprobado"
                        : req.status === "rejected"
                          ? "❌ Rechazado"
                          : "🚫 Cancelado"}
                  </span>
                </div>

                {req.status === "pending" && (
                  <button
                    onClick={() => handleCancelSwap(req.id)}
                    className="mt-2 text-xs text-danger-text dark:text-danger transition hover:text-danger-text dark:hover:text-danger"
                  >
                    Cancelar solicitud
                  </button>
                )}

                {req.admin_notes && req.admin_notes === "Aprobado automáticamente" ? (
                  <p className="mt-1 text-xs text-success-text dark:text-success">
                    Aprobado automáticamente — el horario tenía lugar disponible
                  </p>
                ) : req.admin_notes ? (
                  <p className="mt-1 text-xs text-text-secondary">
                    {req.admin_notes}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL SOLICITAR CAMBIO */}
      {showModal && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-surface-elevated p-6 sm:rounded-2xl shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">
                Solicitar cambio de horario
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
                onChange={(e) => {
                  setSwapDate(e.target.value);
                  setSwapSlotId("");
                }}
                className="w-full rounded-xl bg-surface-input px-3 py-2.5 text-sm text-text-primary"
              />
            </div>

            {swapDate && (
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
                          onClick={() => setSwapSlotId(slot.id)}
                          className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            Number(swapSlotId) === slot.id
                              ? "bg-info text-white"
                              : full
                                ? "bg-surface-input text-danger-text dark:text-danger"
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
                disabled={!swapDate || !swapSlotId || submittingSwap}
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
