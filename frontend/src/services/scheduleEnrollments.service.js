import { apiFetch } from "./api";

export async function getScheduleEnrollments(scheduleId) {
  return apiFetch(`/api/activities/schedules/${scheduleId}/enrollments/`);
}

export async function getScheduleEnrollmentCount(scheduleId) {
  const data = await apiFetch(
    `/api/activities/schedules/${scheduleId}/enrollments/?page=1&page_size=1`
  );
  return data.count ?? 0;
}

export async function unenrollMember(scheduleId, memberId) {
  return apiFetch(`/api/activities/schedules/${scheduleId}/unenroll/`, {
    method: "POST",
    body: JSON.stringify({ member_id: memberId }),
  });
}

export async function enrollMember(scheduleId, memberId) {
  return apiFetch(`/api/activities/schedules/${scheduleId}/enroll/`, {
    method: "POST",
    body: JSON.stringify({ member_id: memberId }),
  });
}
