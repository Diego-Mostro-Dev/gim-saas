import { useState } from "react";

import { Plus } from "lucide-react";

import BottomNav from "../components/dashboard/BottomNav";

import PaymentCard from "../components/payments/PaymentCard";
import PaymentForm from "../components/payments/PaymentForm";

import { usePayments } from "../hooks/usePayments";
import PaymentStats from "../components/payments/PaymentStats";
import { usePaymentStats } from "../hooks/usePaymentStats";

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

  const { totalAmount, totalPayments, cashPayments, transferPayments } =
    usePaymentStats(payments);

  const [showForm, setShowForm] = useState(false);

  const [editingPayment, setEditingPayment] = useState(null);

  const [formData, setFormData] = useState({
    amount: "",
    payment_method: "cash",
    notes: "",
    member: "",
    subscription: "",
  });

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      if (editingPayment) {
        await handleUpdatePayment(editingPayment.id, formData);
      } else {
        await handleCreatePayment(formData);
      }

      handleCloseForm();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("¿Eliminar pago?");

    if (!confirmed) return;

    try {
      await handleDeletePayment(id);
    } catch (error) {
      console.error(error);
    }
  }

  function handleEdit(payment) {
    setEditingPayment(payment);

    setFormData({
      amount: payment.amount,
      payment_method: payment.payment_method,
      notes: payment.notes || "",
      member: payment.member,
      subscription: payment.subscription,
    });

    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);

    setEditingPayment(null);

    setFormData({
      amount: "",
      payment_method: "cash",
      notes: "",
      member: "",
      subscription: "",
    });
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pagos</h1>

          <p className="mt-1 text-sm text-zinc-400">
            Gestión de pagos del gimnasio
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
      <PaymentStats
        totalAmount={totalAmount}
        totalPayments={totalPayments}
        cashPayments={cashPayments}
        transferPayments={transferPayments}
      />

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

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
              onEdit={handleEdit}
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
