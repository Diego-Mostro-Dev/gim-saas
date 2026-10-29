import { useEffect, useState } from "react";
import { getGym } from "../services/gym.service";
import { getCached, isCacheFresh } from "../utils/cache";

const CACHE_KEY = "gym";
const TTL = 10 * 60 * 1000;

export function useGym({ skip = false } = {}) {
  const [gym, setGym] = useState(() => getCached(CACHE_KEY) || null);

  useEffect(() => {
    if (skip) return;
    const load = async () => {
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
    };
    load();

  }, [skip]);

  return { gym };
}
