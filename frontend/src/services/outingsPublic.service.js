import { apiFetch } from "./api";

export function getPublicOutings(token) {
  return apiFetch(`/api/outings/public/${token}/`, { skipAuth: true });
}

export function createPublicOutingEnrollmentRequest(token, payload) {
  return apiFetch(`/api/outings/public/${token}/requests/`, {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export function cancelPublicOutingEnrollmentRequest(token, requestId) {
  return apiFetch(`/api/outings/public/${token}/requests/${requestId}/`, {
    method: "DELETE",
    skipAuth: true,
  });
}