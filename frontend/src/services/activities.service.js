import { apiFetch } from "./api";
import { setCached } from "../utils/cache";

export async function getActivities() {
  const data = await apiFetch("/api/activities/activities/");
  setCached("activities", data);
  return data;
}

export async function getActivity(id) {
  return apiFetch(`/api/activities/activities/${id}/`);
}

export async function createActivity(data) {
  return apiFetch("/api/activities/activities/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateActivity(id, data) {
  return apiFetch(`/api/activities/activities/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function toggleActivityActive(id, active) {
  return apiFetch(`/api/activities/activities/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}

export async function deleteActivity(id) {
  return apiFetch(`/api/activities/activities/${id}/`, {
    method: "DELETE",
  });
}
