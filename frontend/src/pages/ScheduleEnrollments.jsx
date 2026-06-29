import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Search, UserPlus } from "lucide-react";
import toast from "react-hot-toast";

import ConfirmModal from "../components/ui/ConfirmModal";
import EnrollMemberModal from "../components/activities/EnrollMemberModal";
import { DAY_NAMES } from "../constants/days";

import { useScheduleEnrollments } from "../hooks/useScheduleEnrollments";

function ScheduleEnrollments() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const scheduleState = location.state?.schedule;
  const activityId = scheduleState?.activity;

  const {
    enrollments,
    loading,
    error,
    activityName,
    handleUnenroll,
    reload,
  } = useScheduleEnrollments(scheduleId, activityId);

  const [searchTerm, setSearchTerm] = useState("");

  const [showUnenrollModal, setShowUnenrollModal] = useState(false);
  const [memberToUnenroll, setMemberToUnenroll] = useState(null);

  const [showEnrollModal, setShowEnrollModal] = useState(false);

  const dayLabel = scheduleState
    ? DAY_NAMES[scheduleState.day] || scheduleState.day
    : "";

  function formatTime(timeStr) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":");
    return `${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
  }

  const timeRange = scheduleState
    ? `${formatTime(scheduleState.start_time)} - ${formatTime(scheduleState.end_time)}`
    : "";

  const capacity = scheduleState?.capacity;

  const activeEnrollments = enrollments.filter((e) => e.active !== false);
  const enrolledCount = activeEnrollments.length;

  const filteredEnrollments = activeEnrollments.filter((e) => {
    if (!searchTerm) return true;
    const fullName =
      `${e.member.first_name} ${e.member.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  function handleOpenUnenrollModal(memberId) {
    setMemberToUnenroll(memberId);
    setShowUnenrollModal(true);
  }

  async function handleConfirmUnenroll() {
    try {
      await handleUnenroll(memberToUnenroll);
      toast.success("Miembro desinscripto");
      setShowUnenrollModal(false);
      setMemberToUnenroll(null);
    } catch (err) {
      toast.error(err.message || "Error al desinscribir");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando inscriptos...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      {/* HEADER */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() =>
            navigate(`/activities/${activityId}/schedules`)
          }
          className="rounded-lg bg-surface-elevated p-2 text-text-secondary transition hover:bg-surface-hover"
          aria-label="Volver a horarios"
        >
          <ArrowLeft size={20} />
        </button>

        <h1 className="text-2xl font-bold">Inscriptos</h1>
      </div>

      {/* SCHEDULE INFO */}
      <div className="mb-4 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-text-secondary">Actividad</p>
            <p className="text-sm font-medium text-text-primary">
              {activityName || `Actividad #${activityId}`}
            </p>
          </div>

          <div>
            <p className="text-xs text-text-secondary">Horario</p>
            <p className="text-sm font-medium text-text-primary">
              {dayLabel}{dayLabel && timeRange ? " · " : ""}{timeRange}
            </p>
          </div>

          <div>
            <p className="text-xs text-text-secondary">Capacidad</p>
            <p className="text-sm font-medium text-text-primary">
              {capacity != null ? `${enrolledCount} / ${capacity}` : enrolledCount}
            </p>
          </div>

          <div>
            <p className="text-xs text-text-secondary">Disponibles</p>
            <p className={`text-sm font-medium ${
              capacity != null && capacity - enrolledCount <= 0
                ? "text-danger-text"
                : capacity != null && capacity - enrolledCount < Math.max(1, Math.round(capacity * 0.2))
                  ? "text-warning-text"
                  : "text-text-primary"
            }`}>
              {capacity != null ? capacity - enrolledCount : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger-text dark:bg-danger/10 dark:text-danger">
          {error}
        </div>
      )}

      {/* SEARCH + ENROLL BUTTON */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-3">
        <Search size={18} className="text-text-secondary" />

        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
        />

        <button
          onClick={() => setShowEnrollModal(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-600"
          aria-label="Inscribir miembro"
        >
          <UserPlus size={14} />
          <span className="hidden sm:inline">Inscribir</span>
        </button>
      </div>

      {/* LIST */}
      <div className="space-y-2">
        {filteredEnrollments.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center shadow-sm">
            <p className="text-sm text-text-primary">
              {searchTerm
                ? "No se encontraron miembros con ese nombre."
                : "No hay miembros inscriptos todavía."}
            </p>

            {!searchTerm && (
              <button
                onClick={() => setShowEnrollModal(true)}
                className="mt-4 rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600"
              >
                <UserPlus size={16} className="inline mr-1.5" />
                Inscribir miembro
              </button>
            )}
          </div>
        ) : (
          filteredEnrollments.map((enrollment) => {
            const initial = (
              enrollment.member.first_name?.[0] || ""
            ).toUpperCase();

            return (
              <div
                key={enrollment.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-bg text-sm font-bold text-info-text dark:bg-info/15 dark:text-info">
                  {initial}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-text-primary">
                    {enrollment.member.first_name}{" "}
                    {enrollment.member.last_name}
                  </p>
                </div>

                <button
                  onClick={() =>
                    handleOpenUnenrollModal(enrollment.member.id)
                  }
                  className="shrink-0 rounded-lg bg-danger-bg px-3 py-2 text-xs font-medium text-danger-text transition hover:bg-danger-bg dark:bg-danger/15 dark:text-danger"
                  aria-label="Desinscribir miembro"
                >
                  Desinscribir
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ENROLL MEMBER MODAL */}
      {showEnrollModal && (
        <EnrollMemberModal
          scheduleId={scheduleId}
          enrollments={enrollments}
          onClose={() => setShowEnrollModal(false)}
          onSuccess={reload}
        />
      )}

      {/* CONFIRM UNENROLL MODAL */}
      <ConfirmModal
        isOpen={showUnenrollModal}
        title="Desinscribir miembro"
        message="El miembro será removido de este horario."
        confirmText="Desinscribir"
        cancelText="Cancelar"
        onClose={() => {
          setShowUnenrollModal(false);
          setMemberToUnenroll(null);
        }}
        onConfirm={handleConfirmUnenroll}
      />
    </div>
  );
}

export default ScheduleEnrollments;
