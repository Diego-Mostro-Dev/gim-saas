import { apiFetch } from "./api";

export async function getPersonalTrainingServices() {
  return apiFetch("/api/personal-training/services/");
}

export async function createPersonalTrainingService(data) {
  return apiFetch("/api/personal-training/services/", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
}

export async function updatePersonalTrainingService(id, data) {
  return apiFetch(`/api/personal-training/services/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
}

export async function deletePersonalTrainingService(id) {
  return apiFetch(`/api/personal-training/services/${id}/`, {
    method: "DELETE",
  });
}

export async function reactivatePersonalTrainingService(id) {
  return apiFetch(`/api/personal-training/services/${id}/reactivate/`, {
    method: "POST",
  });
}

export async function getPersonalTrainers() {
  return apiFetch("/api/personal-training/trainers/");
}

export async function getPersonalTrainingAssignments(params = {}) {
  const query = new URLSearchParams();
  if (params.active !== undefined) query.set("active", String(params.active));
  if (params.trainer_id) query.set("trainer_id", params.trainer_id);
  if (params.member_id) query.set("member_id", params.member_id);
  const qs = query.toString();
  return apiFetch(`/api/personal-training/assignments/${qs ? `?${qs}` : ""}`);
}

export async function createPersonalTrainingAssignment(data) {
  return apiFetch("/api/personal-training/assignments/", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
}

export async function updatePersonalTrainingAssignment(id, data) {
  return apiFetch(`/api/personal-training/assignments/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
}

export async function unassignPersonalTraining(id) {
  return apiFetch(`/api/personal-training/assignments/${id}/`, {
    method: "DELETE",
  });
}

export async function recordPersonalTrainingSession(id, date) {
  return apiFetch(`/api/personal-training/assignments/${id}/record_session/`, {
    method: "POST",
    body: JSON.stringify({ date }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function removePersonalTrainingSession(id, date) {
  return apiFetch(`/api/personal-training/assignments/${id}/remove_session/`, {
    method: "POST",
    body: JSON.stringify({ date }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function renewPersonalTrainingPackage(id, additionalSessions) {
  return apiFetch(`/api/personal-training/assignments/${id}/renew/`, {
    method: "POST",
    body: JSON.stringify({ additional_sessions: additionalSessions }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function recordPersonalTrainingPayment(id, amount, opts = {}) {
  return apiFetch(`/api/personal-training/assignments/${id}/record_payment/`, {
    method: "POST",
    body: JSON.stringify({
      amount,
      payment_method: opts.payment_method || "cash",
      notes: opts.notes || "",
    }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function getPersonalTrainingChangeRequests(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  return apiFetch(`/api/personal-training/change-requests/${qs ? `?${qs}` : ""}`);
}

export async function approvePersonalTrainingChangeRequest(id, adminNotes = "") {
  return apiFetch(`/api/personal-training/change-requests/${id}/approve/`, {
    method: "POST",
    body: JSON.stringify({ admin_notes: adminNotes || "" }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function rejectPersonalTrainingChangeRequest(id, adminNotes = "") {
  return apiFetch(`/api/personal-training/change-requests/${id}/reject/`, {
    method: "POST",
    body: JSON.stringify({ admin_notes: adminNotes || "" }),
    headers: { "Content-Type": "application/json" },
  });
}

export async function cancelPersonalTrainingChangeRequest(id) {
  return apiFetch(`/api/personal-training/change-requests/${id}/cancel/`, {
    method: "POST",
  });
}

export async function getPublicPersonalTraining(token) {
  return apiFetch(`/api/personal-training/public/${token}/`);
}

export async function createPublicPersonalTrainingChangeRequest(token, data) {
  return apiFetch(`/api/personal-training/public/${token}/change-requests/`, {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
}

export async function cancelPublicPersonalTrainingChangeRequest(token, requestId) {
  return apiFetch(
    `/api/personal-training/public/${token}/change-requests/${requestId}/`,
    { method: "DELETE" },
  );
}