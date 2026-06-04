import { useEffect, useState } from "react";
import { getGym } from "../services/gym.service";

export function useGym() {
  const [gym, setGym] = useState(null);

  useEffect(() => {
    loadGym();
  }, []);

  async function loadGym() {
    try {
      const data = await getGym();
      setGym(data);
    } catch (error) {
      console.error(error);
    }
  }

  return { gym };
}