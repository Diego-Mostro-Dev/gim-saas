const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch(endpoint, options = {}) {
  const { skipAuth = false, ...fetchOptions } = options;

  const token = localStorage.getItem("token");

  const headers = {
    ...fetchOptions.headers,
  };

  const isFormData = fetchOptions.body instanceof FormData;

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (token && !skipAuth) {
    headers.Authorization = `Token ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    let detail;

    try {
      const body = await res.json();
      detail = body.detail || body.message;
    } catch {
      // ignore parse errors
    }

    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }

    throw new ApiError(
      detail || (res.status === 401 ? "Token inválido o expirado" : "Error en la petición"),
      res.status,
    );
  }

  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return null;
  }

  const data = await res.json();

  // Unwrap DRF paginated responses: { results: [...], count: N } → [...]
  if (data && Array.isArray(data.results) && typeof data.count === "number") {
    data.results.totalCount = data.count;
    return data.results;
  }

  return data;
}
