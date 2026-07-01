import { useEffect, useState } from "react";
import { getGym } from "../services/gym.service";
import { getCached, isCacheFresh } from "../utils/cache";

const CACHE_KEY = "gym";
const TTL = 10 * 60 * 1000;

export function useGym() {
  const [gym, setGym] = useState(() => getCached(CACHE_KEY) || {});

  useEffect(() => {
    loadGym();
  }, []);

  async function loadGym() {
    if (isCacheFresh(CACHE_KEY, TTL)) {
      setGym(getCached(CACHE_KEY));
      try {
        const data = await getGym();
        setGym(data);
      } catch (error) {
        console.error(error);
      }
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
