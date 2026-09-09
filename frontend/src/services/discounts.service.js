import { apiFetch } from "./api";

export async function getDiscounts() {
  return apiFetch("/api/gyms/me/discounts/");
}

export async function createDiscount(data) {
  return apiFetch("/api/gyms/me/discounts/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDiscount(id, data) {
  return apiFetch(`/api/gyms/me/discounts/${id}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteDiscount(id) {
  return apiFetch(`/api/gyms/me/discounts/${id}/`, {
    method: "DELETE",
  });
}