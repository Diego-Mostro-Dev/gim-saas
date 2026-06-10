import { apiFetch } from "./api";

/*
|--------------------------------------------------------------------------
| EXERCISES
|--------------------------------------------------------------------------
*/

export async function getExercises() {
  return apiFetch("/api/routines/exercises/");
}

export async function createExercise(data) {
  return apiFetch("/api/routines/exercises/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateExercise(id, data) {
  return apiFetch(`/api/routines/exercises/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteExercise(id) {
  return apiFetch(`/api/routines/exercises/${id}/`, {
    method: "DELETE",
  });
}

/*
|--------------------------------------------------------------------------
| TEMPLATES
|--------------------------------------------------------------------------
*/

export async function getTemplates() {
  return apiFetch("/api/routines/templates/");
}

export async function createTemplate(data) {
  return apiFetch("/api/routines/templates/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTemplate(id, data) {
  return apiFetch(`/api/routines/templates/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTemplate(id) {
  return apiFetch(`/api/routines/templates/${id}/`, {
    method: "DELETE",
  });
}

/*
|--------------------------------------------------------------------------
| ROUTINE EXERCISES
|--------------------------------------------------------------------------
*/

export async function getRoutineExercises() {
  return apiFetch("/api/routines/routine-exercises/");
}

export async function createRoutineExercise(data) {
  return apiFetch("/api/routines/routine-exercises/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRoutineExercise(id, data) {
  return apiFetch(`/api/routines/routine-exercises/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteRoutineExercise(id) {
  return apiFetch(`/api/routines/routine-exercises/${id}/`, {
    method: "DELETE",
  });
}

/*
|--------------------------------------------------------------------------
| ACTIVE ROUTINES
|--------------------------------------------------------------------------
*/

export async function getActiveRoutines() {
  return apiFetch("/api/routines/active/");
}

/*
|--------------------------------------------------------------------------
| ASSIGNMENTS
|--------------------------------------------------------------------------
*/

export async function bulkAssignRoutine(data) {
  return apiFetch("/api/routines/bulk-assign/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/*
|--------------------------------------------------------------------------
| MEMBER ROUTINE
|--------------------------------------------------------------------------
*/

export async function getMemberRoutine(memberId) {
  return apiFetch(
    `/api/routines/member/${memberId}/`
  );
}

export async function getMemberWhatsapp(memberId) {
  return apiFetch(
    `/api/routines/member/${memberId}/whatsapp/`
  );
}

export async function getPublicRoutine(token) {
  return apiFetch(
    `/api/routines/public/${token}/`,
  );
}

/*
|--------------------------------------------------------------------------
| PUBLIC MEMBER PHOTO
|--------------------------------------------------------------------------
*/

export async function updatePublicMemberPhoto(
  token,
  file
) {
  const formData = new FormData();

  formData.append("photo", file);

  return apiFetch(
    `/api/public/${token}/photo/`,
    {
      method: "PATCH",
      body: formData,
    }
  );
}

/*
|--------------------------------------------------------------------------
| PUBLIC SCHEDULE CHANGE REQUESTS (Member Portal)
|--------------------------------------------------------------------------
*/

export async function getPublicSlots(token) {
  return apiFetch(`/api/attendance/public/slots/${token}/`);
}

export async function getPublicScheduleChangeRequests(token) {
  return apiFetch(`/api/attendance/public/schedule-change-requests/${token}/`);
}

export async function createPublicScheduleChangeRequest(token, data) {
  return apiFetch(`/api/attendance/public/schedule-change-requests/${token}/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function cancelPublicScheduleChangeRequest(token, id) {
  return apiFetch(`/api/attendance/public/schedule-change-requests/${token}/${id}/cancel/`, {
    method: "POST",
  });
}