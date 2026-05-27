import { useState } from "react";

const INITIAL_FORM = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
};

export function useMemberForm() {
  const [showForm, setShowForm] = useState(false);

  const [editingMember, setEditingMember] =
    useState(null);

  const [formData, setFormData] =
    useState(INITIAL_FORM);

  function resetForm() {
    setFormData(INITIAL_FORM);

    setEditingMember(null);
  }

  function closeForm() {
    setShowForm(false);

    resetForm();
  }

  function openCreateForm() {
    resetForm();

    setShowForm(true);
  }

  function openEditForm(member) {
    setEditingMember(member);

    setFormData({
      first_name: member.first_name,
      last_name: member.last_name,
      phone: member.phone,
      email: member.email,
    });

    setShowForm(true);
  }

  return {
    showForm,
    formData,
    editingMember,

    setFormData,

    openCreateForm,
    openEditForm,
    closeForm,
    resetForm,
  };
}