import { useState } from "react";

const INITIAL_FORM = {
  member: "",
  plan: "",
  start_date: "",
};

export function useSubscriptionForm() {
  const [showForm, setShowForm] = useState(false);

  const [editingSubscription, setEditingSubscription] =
    useState(null);

  const [formData, setFormData] =
    useState(INITIAL_FORM);

  function openCreateForm() {
    setEditingSubscription(null);

    setFormData(INITIAL_FORM);

    setShowForm(true);
  }

  function openEditForm(subscription) {
    setEditingSubscription(subscription);

    setFormData({
      member: subscription.member,
      plan: subscription.plan,
      start_date: subscription.start_date,
    });

    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
  }

  function resetForm() {
    setEditingSubscription(null);

    setFormData(INITIAL_FORM);
  }

  function updateFormField(field, value) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  return {
    showForm,
    formData,
    editingSubscription,

    setFormData,

    openCreateForm,
    openEditForm,
    closeForm,
    resetForm,
    updateFormField,
  };
}