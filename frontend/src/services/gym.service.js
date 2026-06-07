import { apiFetch } from "./api";

export async function getGym() {
  return apiFetch("/api/gyms/me/");
}

export async function updateGym(data) {
  const isFormData = data instanceof FormData;

  return apiFetch("/api/gyms/me/", {
    method: "PATCH",
    body: isFormData ? data : JSON.stringify(data),
    headers: isFormData
      ? {}
      : {
          "Content-Type": "application/json",
        },
  });
}