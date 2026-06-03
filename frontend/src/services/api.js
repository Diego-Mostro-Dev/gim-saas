const API_URL =
  import.meta.env.VITE_API_URL;

console.log("API URL:", API_URL);
export async function apiFetch(
  endpoint,
  options = {},
) {
  const token =
    localStorage.getItem("token");

  const headers = {
    "Content-Type":
      "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization =
      `Token ${token}`;
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers,
    },
  );

  if (!response.ok) {
    let error = {};

    try {
      error =
        await response.json();
    } catch {
      error = {};
    }

    throw new Error(
      error.detail ||
        error.message ||
        "Error en la petición",
    );
  }

  // DELETE suele devolver 204
  if (response.status === 204) {
    return null;
  }

  // Evita errores si alguna vista devuelve vacío
  const contentType =
    response.headers.get(
      "content-type",
    );

  if (
    !contentType ||
    !contentType.includes(
      "application/json",
    )
  ) {
    return null;
  }

  return response.json();
}