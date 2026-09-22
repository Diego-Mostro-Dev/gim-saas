import { useEffect, useState } from "react";

import {
  getOutings,
  createOuting,
  updateOuting,
  toggleOutingActive,
  deleteOuting,
  reactivateOuting,
} from "../services/outings.service";
import { getCached, isCacheFresh } from "../utils/cache";

const CACHE_KEY = "outings";
const TTL = 30 * 60 * 1000;

export function useOutings() {
  const [outings, setOutings] = useState(
    () => getCached(CACHE_KEY) || [],
  );

  const [loading, setLoading] = useState(
    () => !isCacheFresh(CACHE_KEY, TTL),
  );

  const [error, setError] = useState(null);

  async function loadOutings() {
    try {
      setLoading(true);
      setError(null);
      const data = await getOutings();
      setOutings(data);
    } catch (err) {
      console.error(err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOutings();
  }, []);

  async function handleCreateOuting(data) {
    try {
      const newOuting = await createOuting(data);
      setOutings((prev) => [newOuting, ...prev]);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async function handleUpdateOuting(id, data) {
    try {
      const updatedOuting = await updateOuting(id, data);
      setOutings((prev) =>
        prev.map((o) =>
          o.id === updatedOuting.id ? updatedOuting : o,
        ),
      );
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async function handleToggleActive(id, active) {
    try {
      const updated = await toggleOutingActive(id, active);
      setOutings((prev) =>
        prev.map((o) => (o.id === updated.id ? updated : o)),
      );
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  function handleSetOuting(outing) {
    setOutings((prev) => {
      const idx = prev.findIndex((o) => o.id === outing.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = outing;
        return next;
      }
      return [outing, ...prev];
    });
  }

  async function handleReactivateOuting(id) {
    try {
      const updated = await reactivateOuting(id);
      handleSetOuting(updated);
      return updated;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async function handleDeleteOuting(id) {
    try {
      await deleteOuting(id);
      setOutings((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  return {
    outings,
    loading,
    error,
    loadOutings,
    handleCreateOuting,
    handleUpdateOuting,
    handleToggleActive,
    handleSetOuting,
    handleReactivateOuting,
    handleDeleteOuting,
  };
}