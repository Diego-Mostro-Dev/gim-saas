import { useEffect, useState, useRef } from "react";

import { Plus } from "lucide-react";

import { useSearchParams } from "react-router-dom";

import toast from "react-hot-toast";

import SubscriptionCard from "../components/subscriptions/SubscriptionCard";
import SubscriptionForm from "../components/subscriptions/SubscriptionForm";
import SubscriptionFilters from "../components/subscriptions/SubscriptionFilters";
import SubscriptionStats from "../components/subscriptions/SubscriptionStats";

import { useSubscriptions } from "../hooks/useSubscriptions";
import { useSubscriptionForm } from "../hooks/useSubscriptionForm";
import { useFilteredSubscriptions } from "../hooks/useFilteredSubscriptions";
import { useSubscriptionStats } from "../hooks/useSubscriptionStats";

function Subscriptions() {
  const {
    subscriptions,
    members,
    plans,
    loading,
    error,
    createNewSubscription,
    editSubscription,
    removeSubscription,
  } = useSubscriptions();

  const {
    showForm,
    formData,
    editingSubscription,
    setFormData,
    openCreateForm,
    openEditForm,
    closeForm,
    resetForm,
  } = useSubscriptionForm();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");

  const [paymentFilter, setPaymentFilter] = useState("all");

  const [searchParams] = useSearchParams();

  const formRef = useRef(null);

  const { filteredSubscriptions } = useFilteredSubscriptions({
    subscriptions,
    searchTerm,
    statusFilter,
    paymentFilter,
  });

  const stats = useSubscriptionStats(subscriptions);

  // Abrir form desde query param
  useEffect(() => {
    const shouldOpenForm = searchParams.get("create");

    if (shouldOpenForm === "true") {
      openCreateForm();
    }
  }, [searchParams, openCreateForm]);

  useEffect(() => {
    if (showForm && editingSubscription && formRef.current) {
      formRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [showForm, editingSubscription]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (editingSubscription) {
        await editSubscription(editingSubscription.id, formData);

        toast.success("Subscription actualizada");
      } else {
        await createNewSubscription(formData);

        toast.success("Subscription creada");
      }

      resetForm();

      closeForm();
    } catch (error) {
      console.error(error);

      toast.error("Ocurrió un error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSubscription(id) {
    const confirmed = window.confirm("¿Eliminar subscription?");

    if (!confirmed) return;

    try {
      await removeSubscription(id);

      toast.success("Subscription eliminada");
    } catch (error) {
      console.error(error);

      toast.error("No se pudo eliminar la subscription");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#131313] text-white">
        Cargando subscriptions...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131313] px-4 pb-28 pt-6 text-white">
      {/* HEADER */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>

          <p className="mt-1 text-sm text-zinc-400">Gestión de membresías</p>
        </div>

        <button
          onClick={() => {
            if (showForm) {
              closeForm();
            } else {
              openCreateForm();
            }
          }}
          className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
        >
          <Plus size={18} />
          {showForm ? "Cerrar" : "Nueva"}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* FORM */}
      {showForm && (
        <div ref={formRef}>
          <SubscriptionForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            members={members}
            plans={plans}
            editingSubscription={editingSubscription}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* STATS */}
      <SubscriptionStats stats={stats} />

      {/* FILTERS */}
      <SubscriptionFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        paymentFilter={paymentFilter}
        setPaymentFilter={setPaymentFilter}
      />

      {/* LIST */}
      {filteredSubscriptions.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-6 text-center text-zinc-400">
          No hay subscriptions que coincidan con los filtros
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSubscriptions.map((subscription) => (
            <SubscriptionCard
              key={subscription.id}
              subscription={subscription}
              onEdit={openEditForm}
              onDelete={handleDeleteSubscription}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Subscriptions;
