import { apiFetch } from "./api";

export async function getMemberEnrollments(token) {
  return apiFetch(`/api/activities/public/${token}/`, { skipAuth: true });
}

export async function unenrollMemberFromActivity(token, scheduleId) {
  return apiFetch(`/api/activities/public/${token}/`, {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ schedule_id: scheduleId }),
  });
}
