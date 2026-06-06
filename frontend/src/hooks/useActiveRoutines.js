import { useEffect, useState } from "react";

import { getActiveRoutines } from "../services/routines.service";

export function useActiveRoutines() {
  const [activeRoutines, setActiveRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadActiveRoutines() {
    try {
      setLoading(true);
      setError(null);

      const data = await getActiveRoutines();

      setActiveRoutines(data);
    } catch (err) {
      setError(
        err.message ||
          "Error al cargar rutinas activas",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActiveRoutines();
  }, []);

  return {
    activeRoutines,
    loading,
    error,
    reload: loadActiveRoutines,
  };
}