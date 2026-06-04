const API_URL = import.meta.env.VITE_API_URL;

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // 🔥 interceptor base (listo para expandir)
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    return;
  }

  if (!res.ok) {
    let error = {};

    try {
      error = await res.json();
    } catch {}

    throw new Error(
      error.detail || error.message || "Error en la petición"
    );
  }

  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return null;
  }

  return res.json();
}