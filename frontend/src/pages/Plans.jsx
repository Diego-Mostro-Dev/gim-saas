import { useState, useRef, useEffect } from "react";

import { Plus } from "lucide-react";

import PlanCard from "../components/plans/PlanCard";
import PlanForm from "../components/plans/PlanForm";

import { usePlans } from "../hooks/usePlans";

function Plans() {
  const {
    plans,
    loading,
    error,
    handleCreatePlan,
    handleUpdatePlan,
    handleDeletePlan,
  } = usePlans();

  const [showForm, setShowForm] = useState(false);

  const formRef = useRef(null);

  const [editingPlan, setEditingPlan] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    duration_days: "",
    weekly_visits: "",
    active: true,
  });

  useEffect(() => {
    if (showForm && editingPlan && formRef.current) {
      formRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [showForm, editingPlan]);

  async function onSubmit(e) {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    const payload = {
      ...formData,
      weekly_visits: formData.weekly_visits === "" ? null : formData.weekly_visits,
    };

    try {
      if (editingPlan) {
        await handleUpdatePlan(editingPlan.id, payload);
      } else {
        await handleCreatePlan(payload);
      }

      handleCloseForm();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onDelete(id) {
    const confirmed = window.confirm("¿Eliminar plan?");

    if (!confirmed) return;

    try {
      await handleDeletePlan(id);
    } catch (error) {
      console.error(error);
    }
  }

  function onEdit(plan) {
    setEditingPlan(plan);

    setFormData({
      name: plan.name,
      description: plan.description || "",
      price: plan.price,
      duration_days: plan.duration_days,
      weekly_visits: plan.weekly_visits ?? "",
      active: plan.active,
    });

    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);

    setEditingPlan(null);

    setFormData({
      name: "",
      description: "",
      price: "",
      duration_days: "",
      weekly_visits: "",
      active: true,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando planes...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface px-4 pb-28 pt-6 text-text-primary">
      <div className="mb-6 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planes</h1>

          <p className="mt-1 text-sm text-text-secondary">
            Gestión de planes del gimnasio
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
          className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus size={18} />
          Nuevo
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="mb-6">
          <PlanForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
            editingPlan={editingPlan}
          />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-danger-bg dark:bg-danger/10 p-4 text-sm text-danger-text dark:text-danger">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {plans.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-elevated p-4 text-sm text-text-secondary shadow-sm">
            No hay planes creados
          </div>
        ) : (
          plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default Plans;
