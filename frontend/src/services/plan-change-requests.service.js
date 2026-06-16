import { apiFetch } from "./api";
import { setCached } from "../utils/cache";

export async function getPlanChangeRequests() {
  const data = await apiFetch("/api/plan-change-requests/");
  setCached("plan-change-requests", data);
  return data;
}

export async function approvePlanChangeRequest(id) {
  return apiFetch(
    `/api/plan-change-requests/${id}/approve/`,
    {
      method: "POST",
    },
  );
}

export async function rejectPlanChangeRequest(id, data) {
  return apiFetch(
    `/api/plan-change-requests/${id}/reject/`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}
