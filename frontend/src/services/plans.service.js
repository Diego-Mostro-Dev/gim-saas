const API_URL =
  "http://localhost:8000/api/plans/";

export async function getPlans() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(
      "Error obteniendo planes"
    );
  }

  return response.json();
}