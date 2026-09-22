import { apiFetch } from "./api";

export function getPublicOutings(token) {
  return apiFetch(`/api/outings/public/${token}/`, { skipAuth: true });
}