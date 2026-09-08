import { apiFetch } from "./api";
import { setCached } from "../utils/cache";

export async function getGym() {
  const data = await apiFetch("/api/gyms/me/");
  setCached("gym", data);
  return data;
}

export async function getPublicGym(gymCode) {
  return apiFetch(`/api/gyms/public/${gymCode}/`);
}

export async function updateGym(data) {
  const isFormData = data instanceof FormData;

  const result = await apiFetch("/api/gyms/me/", {
    method: "PATCH",
    body: isFormData ? data : JSON.stringify(data),
    headers: isFormData
      ? {}
      : {
          "Content-Type": "application/json",
        },
  });
  window.dispatchEvent(new Event("features:updated"));
  return result;
}

export async function getClosedDates() {
  return apiFetch("/api/gyms/me/closed-dates/");
}

export async function createClosedDate(data) {
  const result = await apiFetch("/api/gyms/me/closed-dates/", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
  window.dispatchEvent(new Event("closed-dates:updated"));
  return result;
}

export async function deleteClosedDate(id) {
  const result = await apiFetch(`/api/gyms/me/closed-dates/${id}/`, {
    method: "DELETE",
  });
  window.dispatchEvent(new Event("closed-dates:updated"));
  return result;
}