import { apiFetch, fetchAllPages } from "./api";
import { setCached } from "../utils/cache";

export async function getSubscriptions() {
  const data = await fetchAllPages("/api/subscriptions/");
  setCached("subscriptions", data);
  return data;
}

export async function getMemberOutstanding(memberId) {
  return apiFetch(`/api/subscriptions/member/${memberId}/outstanding/`);
}

export async function reopenSubscription(memberId) {
  return apiFetch("/api/subscriptions/reopen/", {
    method: "POST",
    body: JSON.stringify({ member_id: memberId }),
  });
}

