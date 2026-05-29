const API_BASE =
  "http://localhost:8000/api/attendance";

export async function getWeeklyAttendance() {
  const response = await fetch(
    `${API_BASE}/weekly/`,
  );

  if (!response.ok) {
    throw new Error(
      "Error obteniendo asistencia semanal",
    );
  }

  return response.json();
}

export async function getAttendanceStatus(
  day,
  hour,
) {
  const response = await fetch(
    `${API_BASE}/status/?day=${day}&hour=${hour}`,
  );

  if (!response.ok) {
    throw new Error(
      "Error obteniendo estado de asistencia",
    );
  }

  return response.json();
}

export async function registerAttendance(
  scheduleId,
) {
  const response = await fetch(
    `${API_BASE}/register/`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        schedule: scheduleId,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      "Error registrando asistencia",
    );
  }

  return response.json();
}