const API_URL =
  "http://localhost:8000/api/payments/";

export async function getPayments() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(
      "Error obteniendo pagos",
    );
  }

  return response.json();
}

export async function createPayment(data) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(
      "Error creando pago",
    );
  }

  return response.json();
}

export async function updatePayment(
  id,
  data,
) {
  const response = await fetch(
    `${API_URL}${id}/`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    throw new Error(
      "Error actualizando pago",
    );
  }

  return response.json();
}

export async function deletePayment(id) {
  const response = await fetch(
    `${API_URL}${id}/`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(
      "Error eliminando pago",
    );
  }
}