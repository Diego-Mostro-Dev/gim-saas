import { apiFetch } from "./api";
import { setCached } from "../utils/cache";

export async function getPlans() {
  const data = await apiFetch("/api/plans/");
  setCached("plans", data);
  return data;
}

export async function createPlan(
  data,
) {
  return apiFetch(
    "/api/plans/",
    {
      method: "POST",
      body: JSON.stringify(
        data,
      ),
    },
  );
}

export async function updatePlan(
  id,
  data,
) {
  return apiFetch(
    `/api/plans/${id}/`,
    {
      method: "PUT",
      body: JSON.stringify(
        data,
      ),
    },
  );
}

export async function deletePlan(
  id,
) {
  return apiFetch(
    `/api/plans/${id}/`,
    {
      method: "DELETE",
    },
  );
}