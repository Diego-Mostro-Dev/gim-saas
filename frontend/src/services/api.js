export const API_URL = import.meta.env.VITE_API_URL;

const DEFAULT_TIMEOUT_MS = 30000;

export const TOKEN_KEY = "token";
export const TOKEN_EXPIRES_KEY = "token_expires_at";

const AUTH_ENDPOINTS = ["/api/auth/login/", "/api/auth/refresh/"];

export const NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.";

export class ApiError extends Error {
  constructor(message, status, code, feature, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.feature = feature;
    this.data = data;
  }
}

export function isNetworkError(err) {
  return err instanceof ApiError && err.code === "NETWORK_ERROR";
}

function asApiError(err) {
  if (err instanceof ApiError) return err;

  if (err?.name === "AbortError") {
    return new ApiError(
      "La petición tardó demasiado. Intentá de nuevo.",
      0,
      "NETWORK_TIMEOUT",
      null,
      null,
    );
  }

  return new ApiError(NETWORK_ERROR_MESSAGE, 0, "NETWORK_ERROR", null, null);
}

// Combines an optional external AbortSignal with an internal timeout so a
// stalled request never hangs a screen (PWA tabs can stay open for days).
function buildTimeoutController(fetchOptions) {
  const timeoutMs = Number(fetchOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (!timeoutMs || timeoutMs <= 0) {
    return { signal: fetchOptions.signal, cleanup() {} };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const external = fetchOptions.signal;

  const abortExternal = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", abortExternal);
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      if (external) external.removeEventListener("abort", abortExternal);
    },
  };
}

export function extractApiErrorMessage(body) {
  if (!body || typeof body !== "object") {
    return null;
  }

  if (typeof body.detail === "string") return body.detail;
  if (typeof body.message === "string") return body.message;
  if (typeof body.error === "string") return body.error;

  const messages = Object.values(body)
    .flat()
    .filter((v) => typeof v === "string" && v);

  return messages.length > 0 ? messages.join(". ") : null;
}

function buildAuthHeaders(options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { ...options.headers };
  const isFormData = options.body instanceof FormData;
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  // Fuerza JSON siempre (evita que DRF devuelva la BrowsableAPI en HTML en
  // DEBUG, que apiFetch no puede parsear y convierte en null).
  headers["Accept"] = "application/json";
  if (token && !options.skipAuth) {
    headers.Authorization = `Token ${token}`;
  }
  return headers;
}

// Persiste un token nuevo de sesión junto con su expiración (epoch ms).
export function persistSession(token, expiresIn) {
  localStorage.setItem(TOKEN_KEY, token);
  if (typeof expiresIn === "number" && expiresIn > 0) {
    localStorage.setItem(TOKEN_EXPIRES_KEY, String(Date.now() + expiresIn * 1000));
  } else {
    localStorage.removeItem(TOKEN_EXPIRES_KEY);
  }
}

// Limpia la sesión completa (token + expiración).
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRES_KEY);
}

function isAuthEndpoint(url) {
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

let refreshInFlight = null;

// Rota el token vencido contra /api/auth/refresh/. Single-flight: si varias
// requests fallan con 401 al mismo tiempo, solo se hace UN refresh y todas
// comparten el resultado.
async function refreshSessionToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        body: "{}",
      });

      if (!res.ok) return null;

      const data = await res.json();
      persistSession(data.token, data.expires_in);
      return data.token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function throwIfNotOk(res, options = {}) {
  if (!res.ok) {
    let detail;
    let body;
    try {
      body = await res.json();
      detail = extractApiErrorMessage(body);
    } catch {
      // ignore parse errors
    }
    if (res.status === 401 && !options.suppressUnauthorized) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    // Structured FEATURE_DISABLED (new features raise FeatureDisabled with code+feature).
    if (res.status === 403 && body?.code === "FEATURE_DISABLED" && body?.feature) {
      window.dispatchEvent(new Event("features:updated"));
      throw new ApiError(detail, 403, "FEATURE_DISABLED", body.feature, body);
    }
    // Legacy string-based detection for old Activity-only code paths.
    if (res.status === 403 && detail?.includes("Actividades no está habilitado")) {
      window.dispatchEvent(new Event("features:updated"));
      throw new ApiError(detail, 403, "FEATURE_DISABLED", "activities", body);
    }
    throw new ApiError(
      detail || (res.status === 401 ? "Token inválido o expirado" : "Error en la petición"),
      res.status,
      null,
      null,
      body,
    );
  }
}

async function request(
  url,
  fetchOptions,
  { suppressUnauthorized = false, skipAuth = false, retried = false } = {},
) {
  const headers = buildAuthHeaders({ ...fetchOptions, skipAuth });
  const { signal, cleanup } = buildTimeoutController(fetchOptions);

  let res;
  try {
    res = await fetch(url, { ...fetchOptions, headers, signal });
  } catch (err) {
    cleanup();
    throw asApiError(err);
  }

  // Ante un 401 por token vencido (y solo si la request llevaba auth y no es
  // un endpoint de auth en sí), se rota el token y se reintenta UNA vez.
  if (
    res.status === 401 &&
    !skipAuth &&
    !suppressUnauthorized &&
    !retried &&
    !isAuthEndpoint(url)
  ) {
    const newToken = await refreshSessionToken();
    if (newToken) {
      cleanup();
      return request(url, fetchOptions, {
        suppressUnauthorized,
        skipAuth,
        retried: true,
      });
    }
  }

  try {
    await throwIfNotOk(res, { suppressUnauthorized });
  } catch (err) {
    throw asApiError(err);
  } finally {
    cleanup();
  }

  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return null;
  }

  return res.json();
}

export async function apiFetch(endpoint, options = {}) {
  const { skipAuth = false, suppressUnauthorized = false, ...fetchOptions } = options;

  const data = await request(`${API_URL}${endpoint}`, fetchOptions, {
    skipAuth,
    suppressUnauthorized,
  });

  // Unwrap DRF paginated responses: { results: [...], count: N } → [...]
  if (data && Array.isArray(data.results) && typeof data.count === "number") {
    data.results.totalCount = data.count;
    return data.results;
  }

  return data;
}

export async function fetchAllPages(endpoint, options = {}) {
  const { skipAuth = false, ...fetchOptions } = options;

  const allResults = [];
  let url = `${API_URL}${endpoint}`;
  let totalCount = 0;

  while (url) {
    const data = await request(url, fetchOptions, { skipAuth });

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
