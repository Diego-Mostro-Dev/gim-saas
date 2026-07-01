import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import toast from "react-hot-toast";

import ScheduleCard from "../components/activities/ScheduleCard";
import ScheduleForm from "../components/activities/ScheduleForm";
import ConfirmModal from "../components/ui/ConfirmModal";

import { useActivitySchedules } from "../hooks/useActivitySchedules";

function ActivitySchedules() {
  const { activityId } = useParams();
  const navigate = useNavigate();

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
        toast.success("Horario creado");
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
      toast.success("Horario eliminado");
      setShowDeleteModal(false);
      setScheduleToDelete(null);
    } catch (err) {
      toast.error(err.message || "Error al eliminar el horario");
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

      {/* LIST */}
      <div className="space-y-3">
        {schedules.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center text-sm text-text-secondary shadow-sm">
            {showForm
              ? "Completá el formulario para crear el primer horario."
              : "No hay horarios creados. Presioná \"Nuevo horario\" para comenzar."}
          </div>
        ) : (
          schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onEdit={onEdit}
              onDelete={handleOpenDeleteModal}
            />
          ))
        )}
      </div>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Eliminar horario"
        message="Esta acción no se puede deshacer. También se eliminarán las inscripciones asociadas."
        confirmText="Eliminar"
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
