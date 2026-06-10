import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";

import {
  getPublicRoutine,
  updatePublicMemberPhoto,
  getPublicSlots,
  getPublicScheduleChangeRequests,
  createPublicScheduleChangeRequest,
  cancelPublicScheduleChangeRequest,
} from "../services/routines.service";
import { DAY_NAMES } from "../constants/days";

function formatDate(date) {
  return new Date(date).toLocaleDateString("es-AR");
}

function PublicRoutine() {
  const { token } = useParams();

  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [slots, setSlots] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem("member_token", token);
    }

    loadRoutine();

    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        refreshRoutine();
      }
    }

    document.addEventListener("visibilitychange", refreshIfVisible);

    const interval = setInterval(refreshIfVisible, 5 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      clearInterval(interval);
    };
  }, [token]);

  async function loadRoutine() {
    try {
      setLoading(true);

      const data = await getPublicRoutine(token);

      setRoutine(data);

      if (data.gym?.allow_member_schedule_changes) {
        const [slotsData, requestsData] = await Promise.all([
          getPublicSlots(token),
          getPublicScheduleChangeRequests(token),
        ]);
        setSlots(slotsData);
        setChangeRequests(requestsData);
      }
    } catch (err) {
      console.error(err);

      setError("No se encontró la rutina.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshRoutine() {
    try {
      const data = await getPublicRoutine(token);
      setRoutine(data);
      if (data.gym?.allow_member_schedule_changes) {
        const [slotsData, requestsData] = await Promise.all([
          getPublicSlots(token),
          getPublicScheduleChangeRequests(token),
        ]);
        setSlots(slotsData);
        setChangeRequests(requestsData);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handlePhotoUpload() {
    if (!photoFile) return;

    try {
      setUploadingPhoto(true);

      const response = await updatePublicMemberPhoto(token, photoFile);

      setRoutine((prev) => ({
        ...prev,
        member: {
          ...prev.member,
          photo: response.photo,
        },
      }));

      setPhotoFile(null);
      setPreview(null);

      toast.success("Foto actualizada correctamente");
    } catch (error) {
      console.error(error);

      toast.error("No se pudo actualizar la foto");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function openChangeModal(schedule) {
    setSelectedSchedule(schedule);
    setSelectedSlotId("");
    setShowModal(true);
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

  const availableSlots = selectedSchedule
    ? slots.filter(
        (s) =>
          s.day !== selectedSchedule.day ||
          s.hour !== selectedSchedule.hour
      )
    : [];

  const uniqueDays = [...new Set(availableSlots.map((s) => s.day))];

  const slotsForDay = selectedDay
    ? availableSlots.filter((s) => s.day === selectedDay)
    : [];

  function getSlotDayLabel(dayKey) {
    return DAY_NAMES[dayKey] || dayKey;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#161616] text-white">
        Cargando portal...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#161616] text-red-400">
        {error}
      </div>
    );
  }

  const { member, gym, subscription, schedules, attendance_history, last_payment, payments } = routine;

  return (
    <div className="min-h-screen bg-[#161616] p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* HEADER */}
        <div className="rounded-2xl bg-[#201f1f] p-6">
          <div className="flex items-center gap-4">
            {member.photo ? (
              <img
                src={member.photo}
                alt={member.first_name}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-pink-500 text-2xl font-bold text-white">
                {member.first_name?.charAt(0)}
                {member.last_name?.charAt(0)}
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white">
                {member.first_name} {member.last_name}
              </h1>

              <p className="text-zinc-400">Socio de {gym.name}</p>
            </div>
          </div>

          <div className="mt-5 border-t border-white/5 pt-4">
            <label className="mb-2 block text-sm text-zinc-400">
              Cambiar foto
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;

                setPhotoFile(file);

                if (file) {
                  setPreview(URL.createObjectURL(file));
                } else {
                  setPreview(null);
                }
              }}
              className="w-full rounded-xl bg-[#2a2a2a] px-3 py-2 text-sm text-white"
            />

            {preview && (
              <div className="mt-4">
                <p className="mb-2 text-sm text-zinc-400">Vista previa</p>

                <img
                  src={preview}
                  alt="Preview"
                  className="h-24 w-24 rounded-full border border-white/10 object-cover"
                />
              </div>
            )}

            {photoFile && (
              <button
                onClick={handlePhotoUpload}
                disabled={uploadingPhoto}
                className="mt-3 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white"
              >
                {uploadingPhoto ? "Subiendo..." : "Actualizar foto"}
              </button>
            )}
          </div>
        </div>

        {/* SUSCRIPCIÓN */}
        <div className="rounded-2xl bg-[#201f1f] p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Suscripción
          </h2>

          {subscription ? (
            <>
              <div className="mb-4">
                {subscription.paid ? (
                  <span className="rounded-xl bg-green-500/15 px-3 py-1 text-sm font-semibold text-green-400">
                    ✓ Cuota al día
                  </span>
                ) : (
                  <span className="rounded-xl bg-yellow-500/15 px-3 py-1 text-sm font-semibold text-yellow-300">
                    ⚠ Pendiente de pago
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Plan</span>

                  <span className="text-white">{subscription.plan}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Inicio</span>

                  <span className="text-white">
                    {formatDate(subscription.start_date)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Vencimiento</span>

                  <span className="text-white">
                    {formatDate(subscription.end_date)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Estado</span>

                  <span
                    className={`font-semibold ${
                      subscription.days_remaining > 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {subscription.days_remaining > 0
                      ? `${subscription.days_remaining} días restantes`
                      : subscription.days_remaining === 0
                        ? "Vence hoy"
                        : "Vencido"}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Sin suscripción activa</p>
          )}
        </div>

        {/* HORARIOS */}
        <div className="rounded-2xl bg-[#201f1f] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Horarios
          </h2>

          {schedules.length > 0 ? (
            <div className="space-y-2">
              {schedules.map((schedule, idx) => {
                const hasPending = changeRequests.some(
                  (r) => r.current_schedule === schedule.id && r.status === "pending"
                );
                return (
                  <div
                    key={schedule.id || idx}
                    className="flex items-center justify-between rounded-xl bg-[#2a2a2a] px-4 py-3"
                  >
                    <span className="text-sm text-zinc-300">
                      {DAY_NAMES[schedule.day] || schedule.day} {schedule.hour}
                    </span>
                    {gym.allow_member_schedule_changes && !hasPending && (
                      <button
                        onClick={() => openChangeModal(schedule)}
                        className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-400 transition hover:bg-blue-500/30"
                      >
                        Solicitar cambio
                      </button>
                    )}
                    {hasPending && (
                      <span className="rounded-lg bg-yellow-500/15 px-3 py-1.5 text-xs font-medium text-yellow-400">
                        Pendiente
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sin horarios asignados</p>
          )}
        </div>

        {/* SOLICITUDES DE CAMBIO */}
        {gym.allow_member_schedule_changes && changeRequests.length > 0 && (
          <div className="rounded-2xl bg-[#201f1f] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Solicitudes de cambio
            </h2>

            <div className="space-y-2">
              {changeRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-xl bg-[#2a2a2a] px-4 py-3"
                >
                  <p className="text-xs text-zinc-500">Próximo horario</p>

                  <p className="mt-0.5 text-sm text-zinc-100">
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
                          ? "bg-yellow-500/15 text-yellow-400"
                          : req.status === "approved"
                            ? "bg-green-500/15 text-green-400"
                            : req.status === "rejected"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-zinc-500/15 text-zinc-400"
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
                      className="mt-2 text-xs text-red-400 transition hover:text-red-300"
                    >
                      Cancelar solicitud
                    </button>
                  )}

                  {req.admin_notes && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {req.admin_notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ASISTENCIAS */}
        <div className="rounded-2xl bg-[#201f1f] p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Asistencias recientes
          </h2>

          <p className="mb-4 text-sm text-zinc-400">
            Total registradas: {attendance_history?.length || 0}
          </p>

          {attendance_history?.length > 0 ? (
            <div className="space-y-2">
              {attendance_history.map((attendance, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl bg-[#2a2a2a] px-4 py-3"
                >
                  <span className="font-medium text-green-400">
                    ✓ Asistencia
                  </span>

                  <span className="text-zinc-300">
                    {formatDate(attendance.date)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              Todavía no hay asistencias registradas.
            </p>
          )}
        </div>

        {/* ÚLTIMO PAGO */}
        {last_payment ? (
          <div className="rounded-2xl bg-[#201f1f] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Último pago
            </h2>

            <div className="rounded-xl bg-[#2a2a2a] p-4">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Fecha</span>

                <span className="text-white">
                  {formatDate(last_payment.paid_at)}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-zinc-400">Monto</span>

                <span className="font-semibold text-white">
                  ${Number(last_payment.amount).toLocaleString("es-AR")}
                </span>
              </div>

              {last_payment.payment_method && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-zinc-400">Método</span>

                  <span className="text-white">
                    {last_payment.payment_method === "cash"
                      ? "Efectivo"
                      : last_payment.payment_method === "transfer"
                        ? "Transferencia"
                        : "Tarjeta"}
                  </span>
                </div>
              )}

              {last_payment.plan_name && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-zinc-400">Plan</span>

                  <span className="text-white">
                    {last_payment.plan_name}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* HISTORIAL DE PAGOS */}
        <div className="rounded-2xl bg-[#201f1f] p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Historial de pagos
          </h2>

          {payments?.length > 0 ? (
            <div className="space-y-2">
              {payments.map((payment, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-1 rounded-xl bg-[#2a2a2a] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-white">
                      ${Number(payment.amount).toLocaleString("es-AR")}
                    </span>

                    {payment.plan_name && (
                      <span className="text-xs text-zinc-500">
                        {payment.plan_name}
                      </span>
                    )}

                    <span className="text-xs text-zinc-500">
                      {payment.payment_method === "cash"
                        ? "Efectivo"
                        : payment.payment_method === "transfer"
                          ? "Transferencia"
                          : "Tarjeta"}
                    </span>
                  </div>

                  <span className="text-sm text-zinc-400">
                    {formatDate(payment.paid_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No hay pagos registrados
            </p>
          )}
        </div>

        {/* CONTACTO */}
        {(gym.whatsapp || gym.phone || gym.email) && (
          <div className="rounded-2xl bg-[#201f1f] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Contacto del gimnasio
            </h2>

            <div className="space-y-3">
              {gym.whatsapp && (
                <a
                  href={`https://wa.me/${gym.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl bg-green-600/20 px-4 py-3 text-sm font-medium text-green-400 transition hover:bg-green-600/30"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Contactar por WhatsApp
                </a>
              )}

              {gym.phone && (
                <div className="flex items-center justify-between rounded-xl bg-[#2a2a2a] px-4 py-3">
                  <span className="text-sm text-zinc-400">Teléfono</span>

                  <span className="text-sm text-white">{gym.phone}</span>
                </div>
              )}

              {gym.email && (
                <div className="flex items-center justify-between rounded-xl bg-[#2a2a2a] px-4 py-3">
                  <span className="text-sm text-zinc-400">Email</span>

                  <span className="text-sm text-white">{gym.email}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RUTINA */}
        {routine.routine && (
          <div className="rounded-2xl bg-[#201f1f] p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              💪 Rutina actual
            </h2>

            <p className="text-xl font-bold text-white">
              {routine.routine.routine_name}
            </p>

            <p className="mb-4 text-sm text-zinc-400">
              {routine.routine.exercises?.length || 0} ejercicios
            </p>

            <div className="space-y-3">
              {routine.routine.exercises?.map((exercise) => (
                <div key={exercise.id} className="rounded-xl bg-[#2a2a2a] p-4">
                  <h3 className="font-semibold text-white">{exercise.name}</h3>

                  <p className="mt-2 text-zinc-400">
                    {exercise.sets} series
                    {exercise.reps ? ` • ${exercise.reps} reps` : ""}
                  </p>

                  {exercise.weight && (
                    <p className="mt-1 text-blue-300">
                      Peso: {exercise.weight}
                    </p>
                  )}

                  {exercise.notes && (
                    <p className="mt-2 text-zinc-500">{exercise.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* MODAL SOLICITAR CAMBIO */}
        {showModal && selectedSchedule && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
            <div className="w-full max-w-md rounded-t-2xl bg-[#201f1f] p-6 sm:rounded-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Solicitar cambio de horario
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-zinc-400 transition hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 rounded-xl bg-[#2a2a2a] p-3">
                <p className="text-xs text-zinc-500">Horario actual</p>
                <p className="text-sm text-zinc-200">
                  {DAY_NAMES[selectedSchedule.day] || selectedSchedule.day} {selectedSchedule.hour}
                </p>
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-sm text-zinc-400">Nuevo día</label>
                <select
                  value={selectedDay}
                  onChange={(e) => {
                    setSelectedDay(e.target.value);
                    setSelectedSlotId("");
                  }}
                  className="w-full rounded-xl bg-[#2a2a2a] px-3 py-2.5 text-sm text-white"
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
                  <label className="mb-2 block text-sm text-zinc-400">Nuevo horario</label>
                  <div className="grid grid-cols-2 gap-2">
                    {slotsForDay.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                          Number(selectedSlotId) === slot.id
                            ? "bg-blue-500 text-white"
                            : "bg-[#2a2a2a] text-zinc-300 hover:bg-[#333]"
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
                  className="flex-1 rounded-xl bg-[#2a2a2a] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-[#333]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateRequest}
                  disabled={!selectedSlotId || submitting}
                  className="flex-1 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                >
                  {submitting ? "Enviando..." : "Enviar solicitud"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PublicRoutine;
