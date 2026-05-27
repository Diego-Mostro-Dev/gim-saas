import { useEffect, useState } from "react";

import { Plus } from "lucide-react";

import BottomNav from "../components/dashboard/BottomNav";

import PaymentCard from "../components/payments/PaymentCard";
import PaymentForm from "../components/payments/PaymentForm";

import {
  getPayments,
  createPayment,
  updatePayment,
  deletePayment,
} from "../services/payments.service";

import { getMembers } from "../services/members.service";

import { getSubscriptions } from "../services/subscriptions.service";

function Payments() {
  const [payments, setPayments] = useState([]);

  const [members, setMembers] = useState([]);

  const [subscriptions, setSubscriptions] = useState([]);

  const [loading, setLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showForm, setShowForm] = useState(false);

  const [editingPayment, setEditingPayment] = useState(null);

  const [formData, setFormData] = useState({
    amount: "",
    payment_method: "cash",
    notes: "",
    member: "",
    subscription: "",
  });

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    try {
      const paymentsData = await getPayments();

      const membersData = await getMembers();

      const subscriptionsData = await getSubscriptions();

      setPayments(paymentsData);

      setMembers(membersData);

      setSubscriptions(subscriptionsData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePayment(e) {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (editingPayment) {
        const updatedPayment = await updatePayment(editingPayment.id, formData);

        setPayments((prev) =>
          prev.map((payment) =>
            payment.id === updatedPayment.id ? updatedPayment : payment,
          ),
        );
      } else {
        const newPayment = await createPayment(formData);

        setPayments((prev) => [newPayment, ...prev]);
      }

      handleCloseForm();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeletePayment(id) {
    const confirmed = window.confirm("¿Eliminar pago?");

    if (!confirmed) return;

    try {
      await deletePayment(id);

      setPayments((prev) => prev.filter((payment) => payment.id !== id));
    } catch (error) {
      console.error(error);
    }
  }

  function handleEditPayment(payment) {
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

      {showForm && (
        <div className="mb-6">
          <PaymentForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleCreatePayment}
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
              onEdit={handleEditPayment}
              onDelete={handleDeletePayment}
            />
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default Payments;
