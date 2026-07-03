import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Plus, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

import ScheduleCard from "../components/activities/ScheduleCard";
import ScheduleForm from "../components/activities/ScheduleForm";
import ConfirmModal from "../components/ui/ConfirmModal";
import { DAY_NAMES } from "../constants/days";

import { useActivitySchedules } from "../hooks/useActivitySchedules";
import { getInactiveSchedules, updateActivitySchedule } from "../services/activitySchedules.service";

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  return `${h.padStart(2, "0")}:${(m || "00").padStart(2, "0")}`;
}

function ActivitySchedules() {
  const { activityId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [isPendingActivation, setIsPendingActivation] = useState(() => {
    if (location.state?.fromReactivateWithoutSchedules) return true;
    try {
      const stored = JSON.parse(sessionStorage.getItem("pendingActivation") || "[]");
      return stored.includes(Number(activityId));
    } catch {
      return false;
    }
  });

  const {
    schedules,
    loading,
    error,
    featureDisabled,
    handleCreateSchedule,
    handleUpdateSchedule,
    handleDeleteSchedule,
  } = useActivitySchedules(activityId);

  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    day: "",
    start_time: "",
    end_time: "",
    capacity: "",
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);

  const [inactiveSchedules, setInactiveSchedules] = useState([]);
  const [inactiveLoading, setInactiveLoading] = useState(false);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);

  useEffect(() => {
    if (!activityId) return;
    let cancelled = false;
    async function load() {
      setInactiveLoading(true);
      try {
        const data = await getInactiveSchedules(activityId);
        if (!cancelled) setInactiveSchedules(data);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setInactiveLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [activityId]);

  useEffect(() => {
    if (showForm && editingSchedule && formRef.current) {
      formRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [showForm, editingSchedule]);

  async function onSubmit(e) {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (editingSchedule) {
        await handleUpdateSchedule(editingSchedule.id, formData);
        toast.success("Horario actualizado");
      } else {
        await handleCreateSchedule(formData);
        if (isPendingActivation) {
          toast.success("Horario creado. Actividad activada.");
          setIsPendingActivation(false);
          try {
            const stored = JSON.parse(sessionStorage.getItem("pendingActivation") || "[]");
            const updated = stored.filter((id) => id !== Number(activityId));
            sessionStorage.setItem("pendingActivation", JSON.stringify(updated));
          } catch {
            // silently fail
          }
        } else {
          toast.success("Horario creado");
        }
      }
      handleCloseForm();
    } catch (err) {
      toast.error(err.message || "Error al guardar el horario");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenDeleteModal(id) {
    setScheduleToDelete(id);
    setShowDeleteModal(true);
  }

  async function handleConfirmDelete() {
    try {
      await handleDeleteSchedule(scheduleToDelete);
      toast.success("Horario desactivado");
      setShowDeleteModal(false);
      setScheduleToDelete(null);
    } catch (err) {
      toast.error(err.message || "Error al desactivar el horario");
    }
  }

  async function handleReactivateSchedule(schedule) {
    try {
      await updateActivitySchedule(schedule.id, { active: true });
      setInactiveSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
      toast.success(`Horario del ${DAY_NAMES[schedule.day] || schedule.day} reactivado`);
    } catch (err) {
      toast.error(err.message || "Error al reactivar el horario");
    }
  }

  function onEdit(schedule) {
    setEditingSchedule(schedule);
    setFormData({
      day: schedule.day,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      capacity: schedule.capacity,
    });
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingSchedule(null);
    setFormData({
      day: "",
      start_time: "",
      end_time: "",
      capacity: "",
    });
  }

  const hasActiveSchedules = schedules.length > 0;
  const hasInactiveSchedules = inactiveSchedules.length > 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando horarios...
      </div>
    );
  }

  if (featureDisabled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 text-text-primary">
        <p className="text-text-secondary">
          Las actividades no están habilitadas para este gimnasio.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      {/* HEADER */}
      <div className="mb-6 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/activities")}
            className="rounded-lg bg-surface-elevated p-2 text-text-secondary transition hover:bg-surface-hover"
            aria-label="Volver a actividades"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-3xl font-bold">Horarios</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Gestión de horarios de la actividad
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (showForm) {
              handleCloseForm();
            } else {
              setShowForm(true);
            }
          }}
          className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
        >
          <Plus size={18} />
          {showForm ? "Cerrar" : "Nuevo horario"}
        </button>
      </div>

      {/* FORM */}
      {showForm && (
        <div ref={formRef} className="mb-6">
          <ScheduleForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={onSubmit}
            onCancel={handleCloseForm}
            isSubmitting={isSubmitting}
            editingSchedule={editingSchedule}
          />
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger-text dark:bg-danger/10 dark:text-danger">
          {error}
        </div>
      )}

      {/* PENDING ACTIVATION BANNER */}
      {isPendingActivation && !hasActiveSchedules && (
        <div className="mb-4 rounded-xl border border-warning/20 bg-warning-bg p-4 text-sm text-warning-text dark:bg-warning/10 dark:text-warning">
          <p className="font-medium">Reactivación pendiente</p>
          <p className="mt-1">Creá al menos un horario para activar la actividad. También podés restaurar horarios anteriores desde la sección de inactivos.</p>
        </div>
      )}

      {/* ACTIVE SCHEDULES */}
      {hasActiveSchedules && (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onEdit={onEdit}
              onDelete={handleOpenDeleteModal}
            />
          ))}
        </div>
      )}

      {/* EMPTY STATE — no active schedules */}
      {!hasActiveSchedules && !inactiveLoading && (
        <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center text-sm text-text-secondary shadow-sm">
          {showForm ? (
            "Completá el formulario para crear el primer horario."
          ) : hasInactiveSchedules ? (
            <div>
              <p className="mb-4 font-medium text-text-primary">
                Esta actividad no tiene horarios activos.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
                >
                  <Plus size={16} />
                  Crear nuevo horario
                </button>
                <button
                  onClick={() => setInactiveExpanded(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-surface-elevated border border-border px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                >
                  <RotateCcw size={16} />
                  Ver horarios inactivos ({inactiveSchedules.length})
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-4 font-medium text-text-primary">
                Esta actividad no tiene horarios. Creá nuevos horarios para que esté disponible para los miembros.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
              >
                <Plus size={16} />
                Crear nuevo horario
              </button>
            </div>
          )}
        </div>
      )}

      {/* INACTIVE SCHEDULES */}
      {hasInactiveSchedules && (
        <div className={hasActiveSchedules ? "mt-8" : "mt-4"}>
          <button
            onClick={() => setInactiveExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-elevated px-4 py-3 text-left shadow-sm transition hover:bg-surface-hover"
          >
            <span className="text-sm font-semibold text-text-secondary">
              Horarios inactivos ({inactiveSchedules.length})
            </span>
            {inactiveExpanded ? <ChevronUp size={18} className="text-text-secondary" /> : <ChevronDown size={18} className="text-text-secondary" />}
          </button>

          {inactiveExpanded && (
            <div className="mt-3 space-y-3">
              {inactiveLoading ? (
                <p className="py-4 text-center text-sm text-text-secondary">Cargando...</p>
              ) : (
                inactiveSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-text-primary">
                            {DAY_NAMES[schedule.day] || schedule.day}
                          </h3>
                          <span className="rounded-md bg-info-bg px-2 py-0.5 text-xs font-medium text-info-text dark:bg-info/15 dark:text-info">
                            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-text-secondary">
                          Capacidad: {schedule.capacity}
                        </p>
                      </div>
                      <button
                        onClick={() => handleReactivateSchedule(schedule)}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-success-bg px-3 py-2 text-xs font-medium text-success-text transition hover:brightness-90 dark:bg-success/15 dark:text-success"
                      >
                        <RotateCcw size={14} />
                        Reactivar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* CONFIRM DEACTIVATE MODAL */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Desactivar horario"
        message="El horario se desactivará. Las inscripciones existentes conservarán su historial."
        confirmText="Desactivar"
        cancelText="Cancelar"
        onClose={() => {
          setShowDeleteModal(false);
          setScheduleToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default ActivitySchedules;
