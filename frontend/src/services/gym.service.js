import { apiFetch } from "./api";

export async function getGym() {
  return apiFetch("/api/gyms/me/");
}