import { apiFetch } from "./api";

export async function getWeeklyAttendance() {
  return apiFetch(
    "/api/attendance/weekly/"
  );
}

export async function getAttendanceStatus(
  day,
  hour,
) {
  return apiFetch(
    `/api/attendance/status/?day=${day}&hour=${hour}`
  );
}

export async function registerAttendance(
  scheduleId,
) {
  return apiFetch(
    "/api/attendance/register/",
    {
      method: "POST",
      body: JSON.stringify({
        schedule: scheduleId,
      }),
    },
  );
}

export async function getSlots() {
  return apiFetch("/api/attendance/slots/");
}

export async function createSlot(data) {
  return apiFetch("/api/attendance/slots/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSlot(id, data) {
  return apiFetch(`/api/attendance/slots/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteSlot(id) {
  return apiFetch(`/api/attendance/slots/${id}/`, {
    method: "DELETE",
  });
}