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
