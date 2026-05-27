import { useState } from "react";

const INITIAL_FORM = {
  amount: "",
  payment_method: "cash",
  notes: "",
  member: "",
  subscription: "",
};

export function usePaymentForm() {
  const [showForm, setShowForm] = useState(false);

  const [editingPayment, setEditingPayment] =
    useState(null);

  const [formData, setFormData] =
    useState(INITIAL_FORM);

  function resetForm() {
    setFormData(INITIAL_FORM);

    setEditingPayment(null);
  }

  function closeForm() {
    setShowForm(false);

    resetForm();
  }

  function openCreateForm() {
    resetForm();

    setShowForm(true);
  }

  function openEditForm(payment) {
    setEditingPayment(payment);

    setFormData({
      amount: payment.amount,
      payment_method:
        payment.payment_method,
      notes: payment.notes || "",
      member: payment.member,
      subscription:
        payment.subscription,
    });

    setShowForm(true);
  }

  return {
    showForm,
    formData,
    editingPayment,

    setFormData,

    openCreateForm,
    openEditForm,
    closeForm,
    resetForm,
  };
}