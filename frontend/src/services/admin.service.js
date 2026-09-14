import { apiFetch } from "./api";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function adminListGyms() {
  return apiFetch("/api/admin/gyms/");
}

export async function adminCreateGym(data) {
  return apiFetch("/api/admin/gyms/", {
    method: "POST",
    body: JSON.stringify(data),
    headers: JSON_HEADERS,
  });
}

export async function adminListFeatures() {
  return apiFetch("/api/admin/features/");
}