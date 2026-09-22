import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronDown, ChevronUp, RotateCcw, X, RotateCw, PlusCircle } from "lucide-react";
import toast from "react-hot-toast";

import OutingPanel from "../components/outings/OutingPanel";
import OutingForm from "../components/outings/OutingForm";

import { useOutings } from "../hooks/useOutings";
import { useGym } from "../hooks/useGym";
import { useFeature } from "../features/FeatureProvider";
import { getInactiveOutings, getOutingTrainers } from "../services/outings.service";
import { txt } from "../utils/labels";

function Outings() {
  const navigate = useNavigate();
  const { gym } = useGym();
  const salidasEnabled = useFeature("salidas");
  const {
    outings,
    loading,
    error,
    handleCreateOuting,
    handleUpdateOuting,
    handleToggleActive,
    handleSetOuting,
    handleReactivateOuting,
  } = useOutings();

  const [trainers, setTrainers] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);
  const cancelledRef = useRef(false);
  const [editingOuting, setEditingOuting] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    trainer: null,
    meeting_place: "",
    duration_minutes: "",
    monthly_price: "",
    billing_mode: "monthly",
    active: true,
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const [inactiveOutings, setInactiveOutings] = useState([]);
  const [inactiveLoading, setInactiveLoading] = useState(false);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);
  const [hasLoadedInactive, setHasLoadedInactive] = useState(false);

  const [reactivateModal, setReactivateModal] = useState(null);
  const [reactivating, setReactivating] = useState(false);

  const [pendingActivation, setPendingActivation] = useState(() => {
    try {
      const stored = sessionStorage.getItem("pendingOutingActivation");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let cancelled = false;
    getOutingTrainers()
      .then((data) => {
        if (!cancelled) setTrainers(data || []);
      })
      .catch(() => {
        if (!cancelled) setTrainers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function addPendingActivation(id) {
    const next = pendingActivation.includes(id) ? pendingActivation : [...pendingActivation, id];
    setPendingActivation(next);
    sessionStorage.setItem("pendingOutingActivation", JSON.stringify(next));
  }

  function removePendingActivation(id) {
    const next = pendingActivation.filter((pid) => pid !== id);
    setPendingActivation(next);
    sessionStorage.setItem("pendingOutingActivation", JSON.stringify(next));
  }

  useEffect(() => {
    cancelledRef.current = false;
    async function load() {
      setInactiveLoading(true);
      try {
        const data = await getInactiveOutings();
        if (!cancelledRef.current) {
          setInactiveOutings(data);
          setHasLoadedInactive(true);
        }
      } catch {
        // silently fail
      } finally {
        setInactiveLoading(false);
      }
    }
    if (inactiveExpanded && !inactiveLoading) {
      load();
    }
    return () => { cancelledRef.current = true; };
  }, [inactiveExpanded]);

  useEffect(() => {
    if (showForm && editingOuting && formRef.current) {
      formRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [showForm, editingOuting]);

  async function onSubmit(e) {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);
    setFieldErrors({});

    const payload = {
      ...formData,
      duration_minutes: formData.duration_minutes === "" ? null : Number(formData.duration_minutes),
    };

    try {
      if (editingOuting) {
        await handleUpdateOuting(editingOuting.id, payload);
        toast.success("Salida actualizada");
      } else {
        await handleCreateOuting(payload);
        toast.success("Salida creada");
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
        toast.error(err.message || "Error al guardar la salida");
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
        setInactiveOutings((prev) => prev.filter((o) => o.id !== id));
      } else {
        removePendingActivation(id);
        setInactiveOutings((prev) => {
          if (prev.find((o) => o.id === id)) return prev;
          const fromActive = outings.find((o) => o.id === id);
          return fromActive ? [{ ...fromActive, active: false }, ...prev] : prev;
        });
      }
      toast.success(active ? "Salida activada" : "Salida desactivada");
    } catch (err) {
      toast.error(err.message || "Error al cambiar estado");
    }
  }

  async function handleRestoreSchedules(outing) {
    setReactivating(true);
    try {
      const updated = await handleReactivateOuting(outing.id);
      handleSetOuting(updated);
      removePendingActivation(outing.id);
      setInactiveOutings((prev) => prev.filter((o) => o.id !== outing.id));
      toast.success(`"${outing.name}" reactivada con sus horarios`);
      setReactivateModal(null);
    } catch (err) {
      toast.error(err.message || "Error al reactivar");
    } finally {
      setReactivating(false);
    }
  }

  function handleCreateSchedulesRedirect(outing) {
    addPendingActivation(outing.id);
    setReactivateModal(null);
    navigate(`/outings/${outing.id}/schedules`);
  }

  function onEdit(outing) {
    setEditingOuting(outing);
    setFormData({
      name: outing.name,
      description: outing.description || "",
      trainer: outing.trainer ?? null,
      meeting_place: outing.meeting_place || "",
      duration_minutes: outing.duration_minutes ?? "",
      monthly_price: outing.monthly_price ?? "",
      billing_mode: outing.billing_mode || "monthly",
      active: outing.active,
    });
    setFieldErrors({});
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingOuting(null);
    setFieldErrors({});
    setFormData({
      name: "",
      description: "",
      trainer: null,
      meeting_place: "",
      duration_minutes: "",
      monthly_price: "",
      billing_mode: "monthly",
      active: true,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando salidas...
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
            {txt(gym, "staff.salidas.disabled")}
          </p>
        </div>
      </div>
    );
  }

  const visibleOutings = outings.filter((o) => o.active !== false);
  const totalEnrolled = visibleOutings.reduce(
    (sum, o) => sum + (o.enrolled_count ?? 0),
    0,
  );

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      {/* SEGMENTED NAV */}
      {salidasEnabled && (
        <div className="mb-6 flex items-center gap-1 rounded-xl border border-border bg-surface-elevated p-1 sm:w-fit">
          {[
            { id: "activities", label: "Actividades" },
            { id: "outings", label: "Running grupal" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id === "activities" ? "/activities" : "/outings")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${
                tab.id === "outings"
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:bg-surface-input hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* HEADER */}
      <div className="mb-6 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Running grupal</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {txt(gym, "staff.salidas.title")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-3 py-1 font-medium text-text-secondary">
              {visibleOutings.length}{" "}
              {visibleOutings.length === 1 ? "salida activa" : "salidas activas"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-3 py-1 font-medium text-text-secondary">
              {totalEnrolled} socios inscriptos
            </span>
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
          {showForm ? "Cerrar" : "Nueva"}
        </button>
      </div>

      {/* FORM */}
      {showForm && (
        <div ref={formRef} className="mb-6">
          <OutingForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={onSubmit}
            onCancel={handleCloseForm}
            isSubmitting={isSubmitting}
            editingOuting={editingOuting}
            errors={fieldErrors}
            trainers={trainers}
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
        {visibleOutings.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-elevated p-6 text-center text-sm text-text-secondary shadow-sm">
            {showForm
              ? "Completá el formulario para crear tu primera salida."
              : inactiveOutings.length > 0
                ? "No hay salidas activas. Expandí la sección de inactivas para reactivar."
                : inactiveLoading
                  ? "Buscando salidas desactivadas..."
                  : hasLoadedInactive
                    ? "No hay salidas creadas. Presioná \"Nueva\" para comenzar."
                    : (
                      <div>
                        <p className="mb-4 font-medium text-text-primary">
                          No hay salidas activas actualmente.
                        </p>
                        <p className="mb-4">
                          Hay salidas desactivadas disponibles.
                        </p>
                        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                          <button
                            onClick={() => setInactiveExpanded(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                          >
                            <RotateCcw size={16} />
                            Ver salidas desactivadas
                          </button>
                        </div>
                      </div>
                    )}
          </div>
        ) : (
          visibleOutings.map((outing) => (
            <OutingPanel
              key={outing.id}
              outing={outing}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
            />
          ))
        )}
      </div>

      {/* INACTIVE OUTINGS */}
      <div className="mt-8">
        <button
          onClick={() => setInactiveExpanded((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-elevated px-4 py-3 text-left shadow-sm transition hover:bg-surface-hover"
        >
          <span className="text-sm font-semibold text-text-secondary">
            Salidas inactivas
            {hasLoadedInactive && ` (${inactiveOutings.length})`}
          </span>
          {inactiveExpanded ? <ChevronUp size={18} className="text-text-secondary" /> : <ChevronDown size={18} className="text-text-secondary" />}
        </button>

          {inactiveExpanded && (
            <div className="mt-3 space-y-3">
              {inactiveLoading ? (
                <p className="py-4 text-center text-sm text-text-secondary">Cargando...</p>
              ) : inactiveOutings.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-secondary">
                  No hay salidas desactivadas.
                </p>
              ) : (
                  inactiveOutings.map((outing) => (
                  <div
                    key={outing.id}
                    className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-semibold text-text-primary">
                          {outing.name}
                        </h3>
                        {pendingActivation.includes(outing.id) && (
                          <p className="mt-1 text-xs font-medium text-warning-text dark:text-warning">
                            Reactivación pendiente: falta crear horarios
                          </p>
                        )}
                        {outing.description && !pendingActivation.includes(outing.id) && (
                          <p className="mt-1 text-sm text-text-secondary line-clamp-2">
                            {outing.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setReactivateModal(outing)}
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

      {/* REACTIVATE MODAL */}
      {reactivateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={() => !reactivating && setReactivateModal(null)}>
          <div
            className="w-full max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary">
                Reactivar salida: {reactivateModal.name}
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
              Esta salida fue desactivada junto con sus horarios. Podés restaurarla o configurarla nuevamente.
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
                      Reactivar la salida y restaurar todos los horarios que tenía.
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
                      La salida se activará automáticamente al crear el primer horario.
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

export default Outings;