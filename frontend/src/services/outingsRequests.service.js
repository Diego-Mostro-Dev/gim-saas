import { apiFetch } from "./api";

const API_OUTINGS = "/api/outings";

export async function getOutingEnrollmentRequests(params = "") {
  const qs = params ? `?${params}` : "";
  return apiFetch(`${API_OUTINGS}/requests/${qs}`);
}

export async function approveOutingEnrollmentRequest(id, data = {}) {
  return apiFetch(`${API_OUTINGS}/requests/${id}/approve/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function rejectOutingEnrollmentRequest(id, data = {}) {
  return apiFetch(`${API_OUTINGS}/requests/${id}/reject/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function cancelOutingEnrollmentRequest(id) {
  return apiFetch(`${API_OUTINGS}/requests/${id}/cancel/`, {
    method: "POST",
  });
}