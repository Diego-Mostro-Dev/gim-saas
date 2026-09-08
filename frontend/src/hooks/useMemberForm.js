import { useState } from "react";

const INITIAL_FORM = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  document_number: "",
  date_of_birth: "",
  health_insurance: "",
  affiliate_number: "",
  insurance: "",
  schedules: [],
  services: ["gym"],
  activity_schedules: [],
};

export function useMemberForm() {
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);

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
      first_name: member.first_name || "",
      last_name: member.last_name || "",
      phone: member.phone || "",
      email: member.email || "",
      document_number: member.document_number || "",
      date_of_birth: member.date_of_birth || "",
      health_insurance: member.health_insurance || "",
      affiliate_number: member.affiliate_number || "",
      insurance: member.insurance_id ?? "",
      schedules: member.schedules || [],
      services: ["gym"],
      activity_schedules: [],
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