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

export async function createPlan(data) {
  const response = await fetch(API_URL, {
    method: "POST",

    headers: {
      "Content-Type":
        "application/json",
    },

    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      "Error creando plan"
    );
  }

  return response.json();
}

export async function updatePlan(
  id,
  data,
) {
  const response = await fetch(
    `${API_URL}${id}/`,
    {
      method: "PUT",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(
      "Error actualizando plan"
    );
  }

  return response.json();
}

export async function deletePlan(id) {
  const response = await fetch(
    `${API_URL}${id}/`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(
      "Error eliminando plan"
    );
  }
}