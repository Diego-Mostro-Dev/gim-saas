import { useCallback, useState } from "react";

const INITIAL_FORM = {
  amount: "",
  payment_method: "cash",
  notes: "",
  member: "",
  subscription: "",
  enrollment: "",
  personal_training_assignment: "",
  concept: "",
};

export function usePaymentForm() {
  const [showForm, setShowForm] = useState(false);

  const [editingPayment, setEditingPayment] =
    useState(null);

  const [formData, setFormData] =
    useState(INITIAL_FORM);

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM);

    setEditingPayment(null);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);

    resetForm();
  }, [resetForm]);

  const openCreateForm = useCallback(() => {
    resetForm();

    setShowForm(true);
  }, [resetForm]);

  const openEditForm = useCallback((payment) => {
    setEditingPayment(payment);

    setFormData({
      amount: payment.amount,
      payment_method:
        payment.payment_method,
      notes: payment.notes || "",
      member: payment.member,
      subscription:
        payment.subscription || "",
      enrollment:
        payment.enrollment || "",
      personal_training_assignment:
        payment.personal_training_assignment || "",
      concept: payment.concept || "",
    });

    setShowForm(true);
  }, []);

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