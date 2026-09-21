import { apiFetch, fetchAllPages } from "./api";

export async function getCommunityBusinesses() {
  return fetchAllPages("/api/community/businesses/");
}

export async function createCommunityBusiness(data) {
  return apiFetch("/api/community/businesses/", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
}

export async function updateCommunityBusiness(id, data) {
  return apiFetch(`/api/community/businesses/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
}

export async function deleteCommunityBusiness(id) {
  return apiFetch(`/api/community/businesses/${id}/`, {
    method: "DELETE",
  });
}

export async function getPublicCommunity(token) {
  return apiFetch(`/api/community/public/${token}/`);
}