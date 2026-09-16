import { apiFetch } from "./api";

export async function getStaff() {
  const data = await apiFetch("/api/gyms/staff/");
  return data;
}

export async function createStaff(data) {
  return apiFetch("/api/gyms/staff/", {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export async function deleteStaff(userId) {
  return apiFetch(`/api/gyms/staff/${userId}/`, {
    method: "DELETE",
  });
}

export async function updateStaffRole(userId, role) {
  return apiFetch(`/api/gyms/staff/${userId}/`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
    headers: {
      "Content-Type": "application/json",
    },
  });
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
