const API_URL =
  "http://localhost:8000/api/attendance/weekly/";

export async function getWeeklyAttendance() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(
      "Error obteniendo asistencia semanal",
    );
  }

  return response.json();
}