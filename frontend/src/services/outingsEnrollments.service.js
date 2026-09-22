import { apiFetch } from "./api";
import { setCached } from "../utils/cache";

const API_OUTINGS = "/api/outings";

export async function getOutingSchedules(outingId) {
  const cacheKey = `outingSchedules_${outingId}`;
  const data = await apiFetch(`${API_OUTINGS}/${outingId}/schedules/`);
  setCached(cacheKey, data);
  return data;
}

export async function createOutingSchedule(outingId, data) {
  return apiFetch(`${API_OUTINGS}/${outingId}/schedules/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateOutingSchedule(id, data) {
  return apiFetch(`${API_OUTINGS}/schedules/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteOutingSchedule(id) {
  return apiFetch(`${API_OUTINGS}/schedules/${id}/`, {
    method: "DELETE",
  });
}

export async function getInactiveOutingSchedules(outingId) {
  return apiFetch(`${API_OUTINGS}/${outingId}/schedules/?active=false`);
}

export async function getScheduleOutingEnrollmentCount(scheduleId) {
  const data = await apiFetch(
    `${API_OUTINGS}/schedules/${scheduleId}/enrollments/?page=1&page_size=1`,
  );
  return data.totalCount ?? 0;
}

export async function getScheduleOutingEnrollments(scheduleId) {
  return apiFetch(`${API_OUTINGS}/schedules/${scheduleId}/enrollments/`);
}

export async function unenrollOutingMember(scheduleId, memberId) {
  return apiFetch(`${API_OUTINGS}/schedules/${scheduleId}/unenroll/`, {
    method: "POST",
    body: JSON.stringify({ member_id: memberId }),
  });
}

export async function enrollOutingMember(scheduleId, memberId, options = {}) {
  return apiFetch(`${API_OUTINGS}/schedules/${scheduleId}/enroll/`, {
    method: "POST",
    body: JSON.stringify({ member_id: memberId, ...options }),
  });
}

export async function recordOutingSession(enrollmentId) {
  return apiFetch(`${API_OUTINGS}/enrollments/${enrollmentId}/record_session/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function removeOutingSession(enrollmentId, date) {
  return apiFetch(`${API_OUTINGS}/enrollments/${enrollmentId}/remove_session/`, {
    method: "POST",
    body: JSON.stringify({ date }),
  });
}

export async function renewOutingEnrollment(enrollmentId, additionalSessions) {
  return apiFetch(`${API_OUTINGS}/enrollments/${enrollmentId}/renew/`, {
    method: "POST",
    body: JSON.stringify({ additional_sessions: additionalSessions }),
  });
}

export async function recordOutingPayment(enrollmentId, amount) {
  return apiFetch(`${API_OUTINGS}/enrollments/${enrollmentId}/record_payment/`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}