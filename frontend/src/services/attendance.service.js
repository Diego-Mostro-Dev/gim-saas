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