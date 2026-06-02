import { apiFetch } from "./api";

export async function getDashboardData() {
  return apiFetch(
    "/api/dashboard/"
  );
}