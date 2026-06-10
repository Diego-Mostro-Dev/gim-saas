import { apiFetch } from "./api";
import { setCached } from "../utils/cache";

export async function getDashboardData() {
  const data = await apiFetch("/api/dashboard/");
  setCached("dashboard", data);
  return data;
}