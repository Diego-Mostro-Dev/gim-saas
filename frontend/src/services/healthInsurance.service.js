import { apiFetch, fetchAllPages } from "./api";

export async function getHealthInsurances() {
  return fetchAllPages("/api/health-insurances/");
}

export async function createHealthInsurance(data) {
  return apiFetch("/api/health-insurances/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateHealthInsurance(id, data) {
  return apiFetch(`/api/health-insurances/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteHealthInsurance(id) {
  return apiFetch(`/api/health-insurances/${id}/`, {
    method: "DELETE",
  });
}
