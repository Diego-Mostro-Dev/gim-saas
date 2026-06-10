import { apiFetch } from "./api";
import { setCached } from "../utils/cache";

export async function getWeeklyAttendance(date) {
  const params = date ? `?date=${date}` : "";
  const data = await apiFetch(`/api/attendance/weekly/${params}`);
  setCached(`weekly-attendance-${date || ""}`, data);
  return data;
}

export async function getAttendanceStatus(
  day,
  hour,
) {
  const data = await apiFetch(
    `/api/attendance/status/?day=${day}&hour=${hour}`
  );
  setCached(`attendance-status-${day}-${hour}`, data);
  return data;
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
  const data = await apiFetch("/api/attendance/slots/");
  setCached("slots", data);
  return data;
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

export async function getScheduleChangeRequests() {
  return apiFetch("/api/attendance/schedule-change-requests/");
}

export async function approveScheduleChangeRequest(id, data = {}) {
  return apiFetch(`/api/attendance/schedule-change-requests/${id}/approve/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function rejectScheduleChangeRequest(id, data = {}) {
  return apiFetch(`/api/attendance/schedule-change-requests/${id}/reject/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getScheduleSwapRequests() {
  return apiFetch("/api/attendance/schedule-swap-requests/");
}

export async function approveScheduleSwapRequest(id, data = {}) {
  return apiFetch(`/api/attendance/schedule-swap-requests/${id}/approve/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function rejectScheduleSwapRequest(id, data = {}) {
  return apiFetch(`/api/attendance/schedule-swap-requests/${id}/reject/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getAttendanceAnalytics(params = {}) {
  const query = new URLSearchParams(params).toString();
  const data = await apiFetch(`/api/attendance/analytics/${query ? `?${query}` : ""}`);
  setCached(`attendance-analytics-${params.start_date}-${params.end_date}`, data);
  return data;
}