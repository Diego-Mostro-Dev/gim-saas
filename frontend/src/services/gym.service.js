import { apiFetch } from "./api";

export async function getGym() {
  return apiFetch("/api/gyms/me/");
}

export async function updateGym(data) {
  return apiFetch("/api/gyms/me/", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}