import { useCallback, useEffect, useState } from "react";

import { getActiveRoutines } from "../services/routines.service";

export function useActiveRoutines() {
  const [activeRoutines, setActiveRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadActiveRoutines = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    getActiveRoutines()
      .then((data) => {
        if (!cancelled) {
          setActiveRoutines(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err.message || "Error al cargar rutinas activas",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    activeRoutines,
    loading,
    error,
    reload: loadActiveRoutines,
  };
}