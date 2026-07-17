import { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { CalendarClock, Sparkles, ChevronDown, ChevronUp, AlertTriangle, X } from "lucide-react";
import toast from "react-hot-toast";

import ConfirmModal from "../components/ui/ConfirmModal";
import { DAY_NAMES } from "../constants/days";
import { useMemberActivities } from "../hooks/useMemberActivities";
import {
  getAvailableActivities,
  enrollMemberPublic,
  unenrollMemberFromActivity,
} from "../services/activitiesPublic.service";

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  return `${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
}

function MemberActivities() {
  const { token } = useOutletContext();
  const navigate = useNavigate();
  const { enrollments, loading, error, handleUnenroll, unenrollingId, reload } =
    useMemberActivities(token);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [scheduleToCancel, setScheduleToCancel] = useState(null);

  const [picker, setPicker] = useState(null);
  const [pickerMode, setPickerMode] = useState(null);
  const [availableSchedules, setAvailableSchedules] = useState([]);
  const [availableActivities, setAvailableActivities] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);
  const [expandedActivityId, setExpandedActivityId] = useState(null);

  function handleOpenCancelModal(scheduleId) {
    setScheduleToCancel(scheduleId);
    setShowCancelModal(true);
  }

  async function handleConfirmCancel() {
    try {
      const ok = await handleUnenroll(scheduleToCancel);
      if (ok) {
        toast.success("Inscripción cancelada correctamente");
      }
    } catch (err) {
      toast.error(err.message || "Error al cancelar inscripción");
    } finally {
      setShowCancelModal(false);
      setScheduleToCancel(null);
    }
  }

  async function openSchedulePicker(enrollment) {
    setPicker(enrollment);
    setPickerMode("schedule");
    setPickerLoading(true);
    setPickerError(null);
    try {
      const data = await getAvailableActivities(token, {
        activity_id: enrollment.activity_id,
      });
      setAvailableSchedules(data[0]?.schedules || []);
    } catch (err) {
      setPickerError(err.message || "Error al cargar horarios");
    } finally {
      setPickerLoading(false);
    }
  }

  async function openActivityPicker(enrollment) {
    setPicker(enrollment);
    setPickerMode("activity");
    setPickerLoading(true);
    setPickerError(null);
    setExpandedActivityId(null);
    try {
      const data = await getAvailableActivities(token, {
        day: enrollment.day,
        start_time: enrollment.start_time,
        end_time: enrollment.end_time,
      });
      setAvailableActivities(data);
    } catch (err) {
      setPickerError(err.message || "Error al cargar actividades");
    } finally {
      setPickerLoading(false);
    }
  }

  async function handleSelectSchedule(newScheduleId) {
    if (!picker) return;
    setSubmittingId(newScheduleId);
    try {
      await unenrollMemberFromActivity(token, picker.schedule);
      await enrollMemberPublic(token, newScheduleId);
      toast.success("Inscripción actualizada correctamente");
      closePicker();
      reload();
    } catch (err) {
      toast.error(err.message || "Error al actualizar inscripción");
      reload();
    } finally {
      setSubmittingId(null);
    }
  }

  function closePicker() {
    setPicker(null);
    setPickerMode(null);
    setAvailableSchedules([]);
    setAvailableActivities([]);
    setPickerError(null);
    setExpandedActivityId(null);
  }

  if (loading) {
    return (
      <p className="py-12 text-center text-sm text-text-secondary">
        Cargando actividades...
      </p>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger-text dark:bg-danger/10 dark:text-danger">
        {error}
      </div>
    );
  }

  if (enrollments.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center shadow-sm">
        <CalendarClock
          size={40}
          className="mx-auto mb-3 text-text-secondary"
        />
        <p className="text-sm text-text-primary">
          No estás inscripto en ninguna actividad.
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Consultá en recepción para inscribirte en actividades extra.
        </p>
      </div>
    );
  }

  const activeEnrollments = enrollments.filter(
    (e) => e.activity_active !== false && e.schedule_active !== false
  );
  const orphanedEnrollments = enrollments.filter(
    (e) => e.schedule_active === false && e.activity_active !== false
  );
  const deactivatedEnrollments = enrollments.filter(
    (e) => e.activity_active === false
  );

  const matchingActivities = [];
  const otherActivities = [];
  if (picker && pickerMode === "activity") {
    for (const a of availableActivities) {
      const hasMatch = a.schedules.some(
        (s) => s.day === picker.day && s.start_time === picker.start_time && s.end_time === picker.end_time
      );
      if (hasMatch) {
        matchingActivities.push(a);
      } else {
        otherActivities.push(a);
      }
    }
  }

  return (
    <div className="space-y-3">
      {activeEnrollments.map((enrollment) => {
        const initial = enrollment.activity_name?.charAt(0).toUpperCase() || "?";
        const dayLabel = DAY_NAMES[enrollment.day] || enrollment.day;

        return (
          <div
            key={enrollment.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
              {initial}
            </div>

            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-text-primary">
                {enrollment.activity_name}
              </p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {dayLabel} · {formatTime(enrollment.start_time)} -{" "}
                {formatTime(enrollment.end_time)}
              </p>
              {enrollment.monthly_price && Number(enrollment.monthly_price) > 0 && (
                <p className="mt-0.5 text-xs font-medium text-info-text dark:text-info">
                  ${Number(enrollment.monthly_price).toLocaleString("es-AR")}/mes
                </p>
              )}
            </div>

            <button
              onClick={() => handleOpenCancelModal(enrollment.schedule)}
              disabled={unenrollingId === enrollment.schedule}
              className="shrink-0 rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-text transition hover:bg-danger/20 dark:bg-danger/15 dark:text-danger disabled:opacity-50"
              aria-label="Cancelar inscripción"
            >
              {unenrollingId === enrollment.schedule
                ? "Cancelando..."
                : "Cancelar"}
            </button>
          </div>
        );
      })}

      {orphanedEnrollments.length > 0 && (
        <div className="pt-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Horarios no disponibles
          </h2>

          {orphanedEnrollments.map((enrollment) => {
            const initial = enrollment.activity_name?.charAt(0).toUpperCase() || "?";
            const dayLabel = DAY_NAMES[enrollment.day] || enrollment.day;

            return (
              <div
                key={enrollment.id}
                className="mb-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-bg text-sm font-bold text-warning-text dark:bg-warning/15 dark:text-warning">
                    {initial}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-text-primary">
                      {enrollment.activity_name}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {dayLabel} · {formatTime(enrollment.start_time)} -{" "}
                      {formatTime(enrollment.end_time)}
                    </p>
                    {enrollment.monthly_price && Number(enrollment.monthly_price) > 0 && (
                      <p className="mt-0.5 text-xs font-medium text-info-text dark:text-info">
                        ${Number(enrollment.monthly_price).toLocaleString("es-AR")}/mes
                      </p>
                    )}

                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning-bg/50 dark:bg-warning/5 p-3">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning-text dark:text-warning" />
                      <p className="text-xs text-warning-text dark:text-warning leading-relaxed">
                        Tu horario asignado ya no está disponible. Podés elegir otro horario en la misma
                        actividad u optar por una actividad diferente.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => openSchedulePicker(enrollment)}
                    className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90"
                  >
                    Elegir otro horario
                  </button>
                  <button
                    onClick={() => openActivityPicker(enrollment)}
                    className="flex-1 rounded-xl border border-border bg-surface-input px-3 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                  >
                    Elegir otra actividad
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deactivatedEnrollments.length > 0 && (
        <div className="pt-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Actividades no disponibles
          </h2>

          {deactivatedEnrollments.map((enrollment) => (
            <div
              key={enrollment.id}
              className="mb-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm opacity-70"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted-bg text-sm font-bold text-text-secondary">
                  {enrollment.activity_name?.charAt(0).toUpperCase() || "?"}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-text-primary">
                    {enrollment.activity_name}
                  </p>
                  <span className="mt-1 inline-block rounded-md bg-muted-bg px-2 py-0.5 text-xs font-medium text-muted-text">
                    No disponible actualmente
                  </span>
                  <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                    Esta actividad ha sido suspendida temporalmente por el gimnasio.
                    Podés elegir otra actividad disponible o contactar al gimnasio
                    para más información.
                  </p>
                </div>
              </div>

              <button
                onClick={() => navigate(`/routine/${token}`)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90"
              >
                <Sparkles size={16} />
                Elegir otra actividad
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={showCancelModal}
        title="Cancelar inscripción"
        message="¿Estás seguro de que querés cancelar tu inscripción en esta actividad?"
        confirmText="Cancelar inscripción"
        cancelText="Volver"
        onClose={() => {
          setShowCancelModal(false);
          setScheduleToCancel(null);
        }}
        onConfirm={handleConfirmCancel}
      />

      {picker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={closePicker}>
          <div
            className="w-full max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary">
                {pickerMode === "schedule" ? "Elegir otro horario" : "Elegir otra actividad"}
              </h3>
              <button
                onClick={closePicker}
                className="rounded-lg p-1.5 text-text-secondary transition hover:bg-surface-hover"
              >
                <X size={20} />
              </button>
            </div>

            {pickerError && (
              <div className="mb-4 rounded-lg border border-danger/20 bg-danger-bg p-3 text-sm text-danger-text dark:bg-danger/10 dark:text-danger">
                {pickerError}
              </div>
            )}

            {pickerLoading ? (
              <p className="py-8 text-center text-sm text-text-secondary">Cargando...</p>
            ) : pickerMode === "schedule" ? (
              <>
                {availableSchedules.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="mb-4 text-sm text-text-secondary">
                      {picker.activity_name} actualmente no tiene horarios disponibles.
                    </p>
                    <button
                      onClick={() => openActivityPicker(picker)}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90"
                    >
                      Elegir otra actividad
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableSchedules.map((schedule) => {
                      const dayLabel = DAY_NAMES[schedule.day] || schedule.day;
                      const busy = submittingId === schedule.id;

                      return (
                        <div
                          key={schedule.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-surface-input p-3"
                        >
                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              {dayLabel}
                            </p>
                            <p className="text-xs text-text-secondary">
                              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-text-secondary">
                              {schedule.available_spots} cupo{schedule.available_spots !== 1 ? "s" : ""}
                            </span>
                            <button
                              onClick={() => handleSelectSchedule(schedule.id)}
                              disabled={busy}
                              className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                            >
                              {busy ? "Asignando..." : "Seleccionar"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                {matchingActivities.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-info-text dark:text-info">
                      Coinciden con tu horario
                    </p>
                    <div className="space-y-2">
                      {matchingActivities.map(renderActivityGroup)}
                    </div>
                  </div>
                )}

                {otherActivities.length > 0 && (
                  <div>
                    {matchingActivities.length > 0 && (
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        Otras actividades
                      </p>
                    )}
                    <div className="space-y-2">
                      {otherActivities.map(renderActivityGroup)}
                    </div>
                  </div>
                )}

                {availableActivities.length === 0 && (
                  <p className="py-4 text-center text-sm text-text-secondary">
                    No hay actividades disponibles en este momento.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  function renderActivityGroup(activity) {
    const isExpanded = expandedActivityId === activity.id;

    return (
      <div key={activity.id} className="rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setExpandedActivityId(isExpanded ? null : activity.id)}
          className="flex w-full items-center justify-between bg-surface-input px-3 py-2.5 text-left"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {activity.name}
            </p>
            {activity.monthly_price && Number(activity.monthly_price) > 0 && (
              <p className="text-xs font-medium text-info-text dark:text-info mt-0.5">
                ${Number(activity.monthly_price).toLocaleString("es-AR")}/mes
              </p>
            )}
            {activity.description && (
              <p className="text-xs text-text-secondary truncate mt-0.5">
                {activity.description}
              </p>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp size={16} className="shrink-0 text-text-secondary ml-2" />
          ) : (
            <ChevronDown size={16} className="shrink-0 text-text-secondary ml-2" />
          )}
        </button>

        {isExpanded && (
          <div className="border-t border-border px-3 py-2 space-y-1.5">
            {activity.schedules.length === 0 ? (
              <p className="py-2 text-center text-xs text-text-secondary">
                Sin horarios disponibles
              </p>
            ) : (
              activity.schedules.map((schedule) => {
                const dayLabel = DAY_NAMES[schedule.day] || schedule.day;
                const busy = submittingId === schedule.id;

                return (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between rounded-lg bg-surface-elevated px-3 py-2 border border-border"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary">
                        {dayLabel} · {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-text-secondary">
                        {schedule.available_spots} cupo{schedule.available_spots !== 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={() => handleSelectSchedule(schedule.id)}
                        disabled={busy}
                        className="rounded-lg bg-blue-500 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                      >
                        {busy ? "..." : "Elegir"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }
}

export default MemberActivities;
