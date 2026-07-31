import { apiFetch, fetchAllPages } from "./api";
import { setCached } from "../utils/cache";

export async function getSubscriptions() {
  const data = await fetchAllPages("/api/subscriptions/");
  setCached("subscriptions", data);
  return data;
}

