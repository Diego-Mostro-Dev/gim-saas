const store = {};

export function getCached(key) {
  const entry = store[key];
  if (!entry) return null;
  return entry.value;
}

export function setCached(key, value) {
  store[key] = { value, timestamp: Date.now() };
}

export function isCacheFresh(key, ttlMs) {
  const entry = store[key];
  if (!entry) return false;
  return Date.now() - entry.timestamp < ttlMs;
}

export function clearCached(key) {
  delete store[key];
}
