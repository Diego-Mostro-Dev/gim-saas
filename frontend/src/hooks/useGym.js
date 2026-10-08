import { useEffect, useState } from "react";
import { getGym } from "../services/gym.service";
import { getCached, isCacheFresh } from "../utils/cache";

const CACHE_KEY = "gym";
const TTL = 10 * 60 * 1000;

export function useGym({ skip = false } = {}) {
  const [gym, setGym] = useState(() => getCached(CACHE_KEY) || null);

  useEffect(() => {
    if (skip) return;
    loadGym();
  }, [skip]);

  async function loadGym() {
    // Fresh cache: serve it and skip the network. Previously every mount
    // revalidated anyway, which meant a GET /api/gyms/me/ per page; the
    // background refresh now comes from FeatureProvider's focus/visibility
    // listeners plus this TTL.
    if (isCacheFresh(CACHE_KEY, TTL)) {
      setGym(getCached(CACHE_KEY));
      return;
    }
    try {
      const data = await getGym();
      setGym(data);
    } catch (error) {
      console.error(error);
    }
  }

  return { gym };
}
