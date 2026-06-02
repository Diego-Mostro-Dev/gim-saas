import { apiFetch } from "./api";

export async function getSubscriptions() {
  return apiFetch(
    "/api/subscriptions/",
  );
}

export async function createSubscription(
  subscriptionData,
) {
  return apiFetch(
    "/api/subscriptions/",
    {
      method: "POST",
      body: JSON.stringify(
        subscriptionData,
      ),
    },
  );
}

export async function deleteSubscription(
  id,
) {
  return apiFetch(
    `/api/subscriptions/${id}/`,
    {
      method: "DELETE",
    },
  );
}

export async function updateSubscription(
  id,
  subscriptionData,
) {
  return apiFetch(
    `/api/subscriptions/${id}/`,
    {
      method: "PUT",
      body: JSON.stringify(
        subscriptionData,
      ),
    },
  );
}