const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(message, status, code, feature) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.feature = feature;
  }
}

function buildAuthHeaders(options = {}) {
  const token = localStorage.getItem("token");
  const headers = { ...options.headers };
  const isFormData = options.body instanceof FormData;
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  if (token && !options.skipAuth) {
    headers.Authorization = `Token ${token}`;
  }
  return headers;
}

async function throwIfNotOk(res) {
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
    if (res.status === 403 && detail?.includes("Actividades no está habilitado")) {
      window.dispatchEvent(new Event("features:updated"));
      throw new ApiError(detail, 403, "FEATURE_DISABLED", "activities");
    }
    throw new ApiError(
      detail || (res.status === 401 ? "Token inválido o expirado" : "Error en la petición"),
      res.status,
    );
  }
}

export async function apiFetch(endpoint, options = {}) {
  const { skipAuth = false, ...fetchOptions } = options;
  const headers = buildAuthHeaders({ ...fetchOptions, skipAuth });

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  await throwIfNotOk(res);

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

export async function fetchAllPages(endpoint, options = {}) {
  const { skipAuth = false, ...fetchOptions } = options;
  const headers = buildAuthHeaders({ ...fetchOptions, skipAuth });

  const allResults = [];
  let url = `${API_URL}${endpoint}`;
  let totalCount = 0;

  while (url) {
    const res = await fetch(url, {
      headers,
      signal: fetchOptions.signal,
    });

    await throwIfNotOk(res);

    const data = await res.json();

    if (Array.isArray(data?.results)) {
      allResults.push(...data.results);
      totalCount = data.count ?? totalCount;
      url = data.next;
    } else {
      return data;
    }
  }

  allResults.totalCount = totalCount;
  return allResults;
}
