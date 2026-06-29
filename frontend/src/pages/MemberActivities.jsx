import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { CalendarClock, X } from "lucide-react";
import toast from "react-hot-toast";

import ConfirmModal from "../components/ui/ConfirmModal";
import { DAY_NAMES } from "../constants/days";
import { useMemberActivities } from "../hooks/useMemberActivities";

function MemberActivities() {
  const { token } = useOutletContext();
  const { enrollments, loading, error, handleUnenroll, unenrollingId, reload } =
    useMemberActivities(token);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [scheduleToCancel, setScheduleToCancel] = useState(null);

  function formatTime(timeStr) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":");
    return `${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
  }

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

  return (
    <div className="space-y-3">
      {enrollments.map((enrollment) => {
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
    </div>
  );
}

export default MemberActivities;
