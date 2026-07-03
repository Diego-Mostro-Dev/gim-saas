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

export async function getAvailableActivities(token, params = {}) {
  const query = new URLSearchParams();
  if (params.activity_id) query.set("activity_id", params.activity_id);
  if (params.day) query.set("day", params.day);
  if (params.start_time) query.set("start_time", params.start_time);
  if (params.end_time) query.set("end_time", params.end_time);
  const qs = query.toString();
  return apiFetch(`/api/activities/public/${token}/available/${qs ? `?${qs}` : ""}`, { skipAuth: true });
}

export async function enrollMemberPublic(token, scheduleId) {
  return apiFetch(`/api/activities/public/${token}/enroll/`, {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ schedule_id: scheduleId }),
  });
}
