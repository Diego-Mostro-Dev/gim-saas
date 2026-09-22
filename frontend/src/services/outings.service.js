import { apiFetch } from "./api";
import { setCached } from "../utils/cache";

const API_OUTINGS = "/api/outings/outings";

export async function getOutings() {
  const data = await apiFetch(`${API_OUTINGS}/`);
  setCached("outings", data);
  return data;
}

export async function getOuting(id) {
  return apiFetch(`${API_OUTINGS}/${id}/`);
}

export async function createOuting(data) {
  return apiFetch(`${API_OUTINGS}/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateOuting(id, data) {
  return apiFetch(`${API_OUTINGS}/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function toggleOutingActive(id, active) {
  return apiFetch(`${API_OUTINGS}/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function deleteOuting(id) {
  return apiFetch(`${API_OUTINGS}/${id}/`, {
    method: "DELETE",
  });
}

export async function getInactiveOutings() {
  return apiFetch(`${API_OUTINGS}/?active=false`);
}

export async function reactivateOuting(id) {
  return apiFetch(`${API_OUTINGS}/${id}/reactivate/`, {
    method: "POST",
  });
}

export async function getOutingTrainers() {
  return apiFetch(`${API_OUTINGS}/trainers/`);
}