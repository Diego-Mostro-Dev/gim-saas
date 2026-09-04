import { ApiError, extractApiErrorMessage } from "./api";

const API_PUBLIC =
  `${import.meta.env.VITE_API_URL}/api/public`;

const TIMEOUT_MS = 30000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function registerPublicMember(
  gymCode,
  formData
) {
  const response = await fetchWithTimeout(
    `${API_PUBLIC}/register/${gymCode}/`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      extractApiErrorMessage(data) || "Error al registrarse",
      response.status,
    );
  }

  return data;
}

export async function getPublicSlots(gymCode) {
  const response = await fetchWithTimeout(
    `${API_PUBLIC}/slots/${gymCode}/`,
  );

  if (!response.ok) {
    throw new Error("Error al cargar horarios disponibles");
  }

  return response.json();
}

export async function getPublicPlans(gymCode) {
  const response = await fetchWithTimeout(
    `${API_PUBLIC}/plans/${gymCode}/`,
  );

  if (!response.ok) {
    throw new Error("Error al cargar planes disponibles");
  }

  return response.json();
}

export async function getPublicActivities(gymCode) {
  const response = await fetchWithTimeout(
    `${API_PUBLIC}/activities/${gymCode}/`,
  );

  if (!response.ok) {
    throw new Error("Error al cargar actividades disponibles");
  }

  return response.json();
}