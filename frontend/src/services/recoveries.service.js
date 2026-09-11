import { apiFetch } from "./api";

export async function getRecoveries(params = {}) {
  const query = new URLSearchParams();
  if (params.member) query.set("member", params.member);
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  return apiFetch(`/api/attendance/recoveries/${qs ? `?${qs}` : ""}`);
}

export async function grantRecovery(data) {
  return apiFetch("/api/attendance/recoveries/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getRecoveryOptions(member, kind, activity, date) {
  const query = new URLSearchParams();
  query.set("member", member);
  query.set("kind", kind);
  if (activity) query.set("activity", activity);
  if (date) query.set("date", date);
  return apiFetch(`/api/attendance/recoveries/options/?${query.toString()}`);
}

export async function undoRecovery(recoveryId) {
  return apiFetch(`/api/attendance/recoveries/${recoveryId}/undo/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getPublicRecoveries(token) {
  return apiFetch(`/api/attendance/public/recoveries/${token}/`, {
    skipAuth: true,
  });
}