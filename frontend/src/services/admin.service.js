import { apiFetch } from "./api";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function adminListGyms() {
  return apiFetch("/api/admin/gyms/");
}

export async function adminGetGym(id) {
  return apiFetch(`/api/admin/gyms/${id}/`);
}

export async function adminUpdateGym(id, data) {
  return apiFetch(`/api/admin/gyms/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
    headers: JSON_HEADERS,
  });
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

export async function adminResetPassword(userId, newPassword) {
  return apiFetch("/api/auth/admin-reset-password/", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      new_password: newPassword,
    }),
  });
}