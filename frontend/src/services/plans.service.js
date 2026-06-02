import { apiFetch } from "./api";

export async function getPlans() {
  return apiFetch(
    "/api/plans/",
  );
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