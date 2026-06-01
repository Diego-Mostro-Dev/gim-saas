const API_URL =
  "https://gim-saas.onrender.com/api/subscriptions/";

export async function getSubscriptions() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(
      "Error obteniendo subscriptions"
    );
  }

  return response.json();
}
export async function createSubscription(
  subscriptionData
) {
  const response = await fetch(
    API_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(
        subscriptionData
      ),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Error creando subscription"
    );
  }

  return response.json();
}
export async function deleteSubscription(
  id
) {
  const response = await fetch(
    `${API_URL}${id}/`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error(
      "Error eliminando subscription"
    );
  }
}
export async function updateSubscription(
  id,
  subscriptionData
) {
  const response = await fetch(
    `${API_URL}${id}/`,
    {
      method: "PUT",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(
        subscriptionData
      ),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Error actualizando subscription"
    );
  }

  return response.json();
}