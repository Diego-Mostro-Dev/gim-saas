import toast from "react-hot-toast";

import { Plus } from "lucide-react";

import BottomNav from "../components/dashboard/BottomNav";

import PaymentCard from "../components/payments/PaymentCard";
import PaymentForm from "../components/payments/PaymentForm";
import PaymentStats from "../components/payments/PaymentStats";

import { usePayments } from "../hooks/usePayments";
import { usePaymentStats } from "../hooks/usePaymentStats";
import { usePaymentForm } from "../hooks/usePaymentForm";

function Payments() {
  const {
    payments,
    members,
    subscriptions,
    loading,
    error,
    isSubmitting,
    handleCreatePayment,
    handleUpdatePayment,
    handleDeletePayment,
  } = usePayments();

  const {
    showForm,
    formData,
    editingPayment,
    setFormData,
    openCreateForm,
    openEditForm,
    closeForm,
    resetForm,
  } = usePaymentForm();

  const { totalAmount, totalPayments, cashPayments, transferPayments } =
    usePaymentStats(payments);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      if (editingPayment) {
        await handleUpdatePayment(editingPayment.id, formData);

        toast.success("Pago actualizado");
      } else {
        await handleCreatePayment(formData);

        toast.success("Pago creado");
      }

      resetForm();

      closeForm();
    } catch (error) {
      console.error(error);

      toast.error("Ocurrió un error");
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("¿Eliminar pago?");

    if (!confirmed) return;

    try {
      await handleDeletePayment(id);

      toast.success("Pago eliminado");
    } catch (error) {
      console.error(error);

      toast.error("No se pudo eliminar el pago");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#131313] text-white">
        Cargando pagos...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131313] px-4 pb-28 pt-6 text-white">
      {/* HEADER */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pagos</h1>

          <p className="mt-1 text-sm text-zinc-400">
            Gestión de pagos del gimnasio
          </p>
        </div>

        <button
          onClick={() => (showForm ? closeForm() : openCreateForm())}
          className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
        >
          <Plus size={18} />
          {showForm ? "Cerrar" : "Nuevo"}
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* STATS */}
      <PaymentStats
        totalAmount={totalAmount}
        totalPayments={totalPayments}
        cashPayments={cashPayments}
        transferPayments={transferPayments}
      />

      {/* FORM */}
      {showForm && (
        <div className="mb-6">
          <PaymentForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            editingPayment={editingPayment}
            members={members}
            subscriptions={subscriptions}
          />
        </div>
      )}

      {/* LIST */}
      <div className="space-y-3">
        {payments.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#201f1f] p-4 text-sm text-zinc-400">
            No hay pagos registrados
          </div>
        ) : (
          payments.map((payment) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              onEdit={openEditForm}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default Payments;
