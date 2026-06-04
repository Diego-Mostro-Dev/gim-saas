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
    price: "",
    duration_days: "",
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

    try {
      if (editingPlan) {
        await handleUpdatePlan(editingPlan.id, formData);
      } else {
        await handleCreatePlan(formData);
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
      price: plan.price,
      duration_days: plan.duration_days,
    });

    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);

    setEditingPlan(null);

    setFormData({
      name: "",
      price: "",
      duration_days: "",
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#131313] text-white">
        Cargando planes...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131313] px-4 pb-28 pt-6 text-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planes</h1>

          <p className="mt-1 text-sm text-zinc-400">
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
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {plans.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4 text-sm text-zinc-400">
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
