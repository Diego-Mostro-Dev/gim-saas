import { apiFetch } from "./api";
import { setCached } from "../utils/cache";

export async function getGym() {
  const data = await apiFetch("/api/gyms/me/");
  setCached("gym", data);
  return data;
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