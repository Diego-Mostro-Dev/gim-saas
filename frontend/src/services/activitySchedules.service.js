import { apiFetch, fetchAllPages } from "./api";
import { setCached } from "../utils/cache";

export async function getActivitySchedules(activityId) {
  const cacheKey = `activitySchedules_${activityId}`;
  const data = await apiFetch(`/api/activities/${activityId}/schedules/`);
  setCached(cacheKey, data);
  return data;
}

export async function createActivitySchedule(activityId, data) {
  return apiFetch(`/api/activities/${activityId}/schedules/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateActivitySchedule(id, data) {
  return apiFetch(`/api/activities/schedules/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteActivitySchedule(id) {
  return apiFetch(`/api/activities/schedules/${id}/`, {
    method: "DELETE",
  });
}
