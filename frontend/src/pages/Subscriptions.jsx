import { useEffect, useState } from "react";

import BottomNav from "../components/dashboard/BottomNav";

import { Plus } from "lucide-react";

import SubscriptionCard from "../components/subscriptions/SubscriptionCard";
import SubscriptionForm from "../components/subscriptions/SubscriptionForm";
import SubscriptionFilters from "../components/subscriptions/SubscriptionFilters";
import SubscriptionStats from "../components/subscriptions/SubscriptionStats";

import { useSubscriptions } from "../hooks/useSubscriptions";
import { useSubscriptionForm } from "../hooks/useSubscriptionForm";
import { useFilteredSubscriptions } from "../hooks/useFilteredSubscriptions";
import { useSubscriptionStats } from "../hooks/useSubscriptionStats";

import { useSearchParams } from "react-router-dom";

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

  const { filteredSubscriptions } = useFilteredSubscriptions({
    subscriptions,
    searchTerm,
    statusFilter,
    paymentFilter,
  });
  const stats = useSubscriptionStats(subscriptions);

  useEffect(() => {
    const shouldOpenForm = searchParams.get("create");

    if (shouldOpenForm === "true") {
      openCreateForm();
    }
  }, [searchParams]);

  async function handleCreateSubscription(e) {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (editingSubscription) {
        await editSubscription(editingSubscription.id, formData);
      } else {
        await createNewSubscription(formData);
      }

      resetForm();

      closeForm();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteSubscription(id) {
    const confirmed = window.confirm("¿Eliminar subscription?");

    if (!confirmed) return;

    await removeSubscription(id);
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>

          <p className="mt-1 text-sm text-zinc-400">Gestión de membresías</p>
        </div>

        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus size={18} />
          Nueva
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {showForm && (
        <SubscriptionForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleCreateSubscription}
          members={members}
          plans={plans}
          editingSubscription={editingSubscription}
          isSubmitting={isSubmitting}
        />
      )}

      <SubscriptionFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        paymentFilter={paymentFilter}
        setPaymentFilter={setPaymentFilter}
      />
      <SubscriptionStats stats={stats} />

      {filteredSubscriptions.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-6 text-center text-zinc-400">
          No hay subscriptions todavía
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

      <BottomNav />
    </div>
  );
}

export default Subscriptions;
