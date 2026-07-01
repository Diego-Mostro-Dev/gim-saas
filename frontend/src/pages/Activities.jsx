import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";

import ActivityCard from "../components/activities/ActivityCard";
import ActivityForm from "../components/activities/ActivityForm";
import ConfirmModal from "../components/ui/ConfirmModal";

import { useActivities } from "../hooks/useActivities";

function Activities() {
  const {
    activities,
    loading,
    error,
    handleCreateActivity,
    handleUpdateActivity,
    handleToggleActive,
    handleDeleteActivity,
  } = useActivities();

  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);
  const [editingActivity, setEditingActivity] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    active: true,
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState(null);

  useEffect(() => {
    if (showForm && editingActivity && formRef.current) {
      formRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [showForm, editingActivity]);

  async function onSubmit(e) {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (editingActivity) {
        await handleUpdateActivity(editingActivity.id, formData);
        toast.success("Actividad actualizada");
      } else {
        await handleCreateActivity(formData);
        toast.success("Actividad creada");
      }
      handleCloseForm();
    } catch (err) {
      toast.error(err.message || "Error al guardar la actividad");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenDeleteModal(id) {
    setActivityToDelete(id);
    setShowDeleteModal(true);
  }

  async function handleConfirmDelete() {
    try {
      await handleDeleteActivity(activityToDelete);
      toast.success("Actividad eliminada");
      setShowDeleteModal(false);
      setActivityToDelete(null);
    } catch (err) {
      toast.error(err.message || "Error al eliminar la actividad");
    }
  }

  async function onToggleActive(id, active) {
    try {
      await handleToggleActive(id, active);
      toast.success(
        active ? "Actividad activada" : "Actividad desactivada",
      );
    } catch (err) {
      toast.error(err.message || "Error al cambiar estado");
    }
  }

  function onEdit(activity) {
    setEditingActivity(activity);
    setFormData({
      name: activity.name,
      description: activity.description || "",
      active: activity.active,
    });
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingActivity(null);
    setFormData({
      name: "",
      description: "",
      active: true,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando actividades...
      </div>
    );
  }

  if (error?.status === 403) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 text-center">
        <div className="rounded-xl bg-surface-elevated p-8 shadow-sm max-w-md">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Módulo desactivado
          </h1>
          <p className="text-text-secondary">
            El módulo de actividades extra no está habilitado para este gimnasio.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      {/* HEADER */}
      <div className="mb-6 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Actividades</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Gestión de actividades extra del gimnasio
          </p>
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
          {showForm ? "Cerrar" : "Nueva"}
        </button>
      </div>

      {/* FORM */}
      {showForm && (
        <div ref={formRef} className="mb-6">
          <ActivityForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={onSubmit}
            onCancel={handleCloseForm}
            isSubmitting={isSubmitting}
            editingActivity={editingActivity}
          />
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-danger-bg p-4 text-sm text-danger-text dark:bg-danger/10 dark:text-danger">
          {error?.message || error}
        </div>
      )}

      {/* LIST */}
      <div className="space-y-3">
        {activities.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center text-sm text-text-secondary shadow-sm">
            {showForm
              ? "Completá el formulario para crear tu primera actividad."
              : "No hay actividades creadas. Presioná \"Nueva\" para comenzar."}
          </div>
        ) : (
          activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onEdit={onEdit}
              onDelete={handleOpenDeleteModal}
              onToggleActive={onToggleActive}
            />
          ))
        )}
      </div>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Eliminar actividad"
        message="Esta acción no se puede deshacer. También se eliminarán todos los horarios asociados."
        confirmText="Eliminar"
        cancelText="Cancelar"
        onClose={() => {
          setShowDeleteModal(false);
          setActivityToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export default Activities;
