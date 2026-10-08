import { apiFetch } from "./api";
import { setCached } from "../utils/cache";

// Up to five components mount with useGym() in the same render flush
// (TopBar, useGymTitle, Dashboard, InstallBanner, FeatureProvider), so share
// one in-flight request instead of firing five identical GETs.
let inflightGym = null;

export async function getGym() {
  if (!inflightGym) {
    inflightGym = apiFetch("/api/gyms/me/")
      .then((data) => {
        setCached("gym", data);
        return data;
      })
      .finally(() => {
        inflightGym = null;
      });
  }
  return inflightGym;
}

export async function getPublicGym(gymCode) {
  return apiFetch(`/api/gyms/public/${gymCode}/`);
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
  // Refresh the cache before the event: FeatureProvider reads getCached("gym")
  // on features:updated and would otherwise pick up the pre-PATCH payload.
  setCached("gym", result);
  window.dispatchEvent(new Event("features:updated"));
  return result;
}

export async function getClosedDates() {
  return apiFetch("/api/gyms/me/closed-dates/");
}

export async function createClosedDate(data) {
  const result = await apiFetch("/api/gyms/me/closed-dates/", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
  window.dispatchEvent(new Event("closed-dates:updated"));
  return result;
}

export async function deleteClosedDate(id) {
  const result = await apiFetch(`/api/gyms/me/closed-dates/${id}/`, {
    method: "DELETE",
  });
  window.dispatchEvent(new Event("closed-dates:updated"));
  return result;
}

export async function loadHolidays(year) {
  return apiFetch("/api/gyms/me/closed-dates/holidays/", {
    method: "POST",
    body: JSON.stringify(year ? { year } : {}),
    headers: { "Content-Type": "application/json" },
  });
}