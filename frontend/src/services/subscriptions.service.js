import { apiFetch } from "./api";
import { setCached } from "../utils/cache";

export async function getSubscriptions() {
  const data = await apiFetch("/api/subscriptions/");
  setCached("subscriptions", data);
  return data;
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

export async function renewSubscription(
  id,
) {
  return apiFetch(
    `/api/subscriptions/${id}/renew/`,
    {
      method: "POST",
    },
  );
}