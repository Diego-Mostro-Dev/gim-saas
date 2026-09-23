export const ROSARIO_CENTER = [-32.9442, -60.6505];

const geocodeCache = {};

export async function geocodeGymAddress(gym) {
  if (!gym) return null;
  const query = [gym.seo_address, gym.seo_city].filter(Boolean).join(", ");
  if (!query) return null;
  if (geocodeCache[query]) return geocodeCache[query];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const results = await res.json();
    const hit = Array.isArray(results) && results[0];
    if (!hit) return null;
    const center = [Number(hit.lat), Number(hit.lon)];
    geocodeCache[query] = center;
    return center;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function haversineKm(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  const R = 6371;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [lat1, lng1] = points[i - 1];
    const [lat2, lng2] = points[i];
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}