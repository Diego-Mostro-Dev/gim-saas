import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronDown, ChevronUp, RotateCcw, X, RotateCw, PlusCircle } from "lucide-react";
import toast from "react-hot-toast";

import ActivityCard from "../components/activities/ActivityCard";
import ActivityForm from "../components/activities/ActivityForm";

import { useActivities } from "../hooks/useActivities";
import { getInactiveActivities, reactivateActivity } from "../services/activities.service";

function Activities() {
  const navigate = useNavigate();
  const {
    activities,
    loading,
    error,
    handleCreateActivity,
    handleUpdateActivity,
    handleToggleActive,
    handleSetActivity,
  } = useActivities();

  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);
  const cancelledRef = useRef(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    monthly_price: "",
    active: true,
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const [inactiveActivities, setInactiveActivities] = useState([]);
  const [inactiveLoading, setInactiveLoading] = useState(false);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);
  const [hasLoadedInactive, setHasLoadedInactive] = useState(false);

  const [reactivateModal, setReactivateModal] = useState(null);
  const [reactivating, setReactivating] = useState(false);

  const [pendingActivation, setPendingActivation] = useState(() => {
    try {
      const stored = sessionStorage.getItem("pendingActivation");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  function addPendingActivation(id) {
    const next = pendingActivation.includes(id) ? pendingActivation : [...pendingActivation, id];
    setPendingActivation(next);
    sessionStorage.setItem("pendingActivation", JSON.stringify(next));
  }

  function removePendingActivation(id) {
    const next = pendingActivation.filter((pid) => pid !== id);
    setPendingActivation(next);
    sessionStorage.setItem("pendingActivation", JSON.stringify(next));
  }

  useEffect(() => {
    cancelledRef.current = false;
    async function load() {
      setInactiveLoading(true);
      try {
        const data = await getInactiveActivities();
        if (!cancelledRef.current) {
          setInactiveActivities(data);
          setHasLoadedInactive(true);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelledRef.current) setInactiveLoading(false);
      }
    }
    if (inactiveExpanded && !hasLoadedInactive && !inactiveLoading) {
      load();
    }
    return () => { cancelledRef.current = true; };
  }, [inactiveExpanded]);

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
    setFieldErrors({});

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
      if (err.data && typeof err.data === "object" && !err.data.detail) {
        const flat = {};
        for (const [key, msgs] of Object.entries(err.data)) {
          flat[key] = Array.isArray(msgs) ? msgs[0] : msgs;
        }
        setFieldErrors(flat);
      } else {
        toast.error(err.message || "Error al guardar la actividad");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onToggleActive(id, active) {
    try {
      await handleToggleActive(id, active);
      if (active) {
        removePendingActivation(id);
        setInactiveActivities((prev) => prev.filter((a) => a.id !== id));
      } else {
        removePendingActivation(id);
        setInactiveActivities((prev) => {
          if (prev.find((a) => a.id === id)) return prev;
          const fromActive = activities.find((a) => a.id === id);
          return fromActive ? [{ ...fromActive, active: false }, ...prev] : prev;
        });
      }
      toast.success(active ? "Actividad activada" : "Actividad desactivada");
    } catch (err) {
      toast.error(err.message || "Error al cambiar estado");
    }
  }

  async function handleRestoreSchedules(activity) {
    setReactivating(true);
    try {
      const updated = await reactivateActivity(activity.id);
      handleSetActivity(updated);
      removePendingActivation(activity.id);
      setInactiveActivities((prev) => prev.filter((a) => a.id !== activity.id));
      toast.success(`"${activity.name}" reactivada con sus horarios`);
      setReactivateModal(null);
    } catch (err) {
      toast.error(err.message || "Error al reactivar");
    } finally {
      setReactivating(false);
    }
  }

  function handleCreateSchedulesRedirect(activity) {
    addPendingActivation(activity.id);
    setReactivateModal(null);
    navigate(`/activities/${activity.id}/schedules`);
  }

  function onEdit(activity) {
    setEditingActivity(activity);
    setFormData({
      name: activity.name,
      description: activity.description || "",
      monthly_price: activity.monthly_price ?? "",
      active: activity.active,
    });
    setFieldErrors({});
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingActivity(null);
    setFieldErrors({});
    setFormData({
      name: "",
      description: "",
      monthly_price: "",
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

  const visibleActivities = activities.filter((a) => a.active !== false);

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
            errors={fieldErrors}
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
        {visibleActivities.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center text-sm text-text-secondary shadow-sm">
            {showForm
              ? "Completá el formulario para crear tu primera actividad."
              : inactiveActivities.length > 0
                ? "No hay actividades activas. Expandí la sección de inactivas para reactivar."
                : inactiveLoading
                  ? "Buscando actividades desactivadas..."
                  : hasLoadedInactive
                    ? "No hay actividades creadas. Presioná \"Nueva\" para comenzar."
                    : (
                      <div>
                        <p className="mb-4 font-medium text-text-primary">
                          No hay actividades activas actualmente.
                        </p>
                        <p className="mb-4">
                          Hay actividades desactivadas disponibles.
                        </p>
                        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                          <button
                            onClick={() => setInactiveExpanded(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                          >
                            <RotateCcw size={16} />
                            Ver actividades desactivadas
                          </button>
                        </div>
                      </div>
                    )}
          </div>
        ) : (
          visibleActivities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
            />
          ))
        )}
      </div>

      {/* INACTIVE ACTIVITIES */}
      {(inactiveActivities.length > 0 || inactiveLoading || hasLoadedInactive) && (
        <div className="mt-8">
          <button
            onClick={() => setInactiveExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-elevated px-4 py-3 text-left shadow-sm transition hover:bg-surface-hover"
          >
            <span className="text-sm font-semibold text-text-secondary">
              Actividades inactivas ({inactiveActivities.length})
            </span>
            {inactiveExpanded ? <ChevronUp size={18} className="text-text-secondary" /> : <ChevronDown size={18} className="text-text-secondary" />}
          </button>

          {inactiveExpanded && (
            <div className="mt-3 space-y-3">
              {inactiveLoading ? (
                <p className="py-4 text-center text-sm text-text-secondary">Cargando...</p>
              ) : inactiveActivities.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-secondary">
                  No hay actividades desactivadas.
                </p>
              ) : (
                  inactiveActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-semibold text-text-primary">
                          {activity.name}
                        </h3>
                        {pendingActivation.includes(activity.id) && (
                          <p className="mt-1 text-xs font-medium text-warning-text dark:text-warning">
                            Reactivación pendiente: falta crear horarios
                          </p>
                        )}
                        {activity.description && !pendingActivation.includes(activity.id) && (
                          <p className="mt-1 text-sm text-text-secondary line-clamp-2">
                            {activity.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setReactivateModal(activity)}
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

      {/* REACTIVATE MODAL */}
      {reactivateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => !reactivating && setReactivateModal(null)}>
          <div
            className="w-full max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary">
                Reactivar actividad: {reactivateModal.name}
              </h3>
              <button
                onClick={() => !reactivating && setReactivateModal(null)}
                className="rounded-lg p-1.5 text-text-secondary transition hover:bg-surface-hover"
                disabled={reactivating}
              >
                <X size={20} />
              </button>
            </div>

            <p className="mb-5 text-sm text-text-secondary">
              Esta actividad fue desactivada junto con sus horarios. Podés restaurarla o configurarla nuevamente.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleRestoreSchedules(reactivateModal)}
                disabled={reactivating}
                className="w-full rounded-xl border border-border bg-surface-elevated p-4 text-left shadow-sm transition hover:bg-surface-hover disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-info-bg p-2 text-info-text dark:bg-info/15 dark:text-info">
                    <RotateCw size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">Restaurar horarios anteriores</p>
                    <p className="mt-0.5 text-sm text-text-secondary">
                      Reactivar la actividad y restaurar todos los horarios que tenía.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleCreateSchedulesRedirect(reactivateModal)}
                className="w-full rounded-xl border border-border bg-surface-elevated p-4 text-left shadow-sm transition hover:bg-surface-hover"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-info-bg p-2 text-info-text dark:bg-info/15 dark:text-info">
                    <PlusCircle size={18} />
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">Crear nuevos horarios</p>
                    <p className="mt-0.5 text-sm text-text-secondary">
                      La actividad se activará automáticamente al crear el primer horario.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {reactivating && (
              <p className="mt-4 text-center text-sm text-text-secondary">Reactivando...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Activities;
