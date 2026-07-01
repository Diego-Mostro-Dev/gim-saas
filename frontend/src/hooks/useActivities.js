import { useEffect, useState } from "react";

import {
  getActivities,
  createActivity,
  updateActivity,
  toggleActivityActive,
  deleteActivity,
} from "../services/activities.service";
import { getCached, isCacheFresh } from "../utils/cache";

const CACHE_KEY = "activities";
const TTL = 30 * 60 * 1000;

export function useActivities() {
  const [activities, setActivities] = useState(
    () => getCached(CACHE_KEY) || [],
  );

  const [loading, setLoading] = useState(
    () => !isCacheFresh(CACHE_KEY, TTL),
  );

  const [error, setError] = useState(null);

  async function loadActivities() {
    if (isCacheFresh(CACHE_KEY, TTL)) {
      setActivities(getCached(CACHE_KEY));
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getActivities();
      setActivities(data);
    } catch (err) {
      console.error(err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, []);

  async function handleCreateActivity(data) {
    try {
      const newActivity = await createActivity(data);
      setActivities((prev) => [newActivity, ...prev]);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async function handleUpdateActivity(id, data) {
    try {
      const updatedActivity = await updateActivity(id, data);
      setActivities((prev) =>
        prev.map((a) =>
          a.id === updatedActivity.id ? updatedActivity : a,
        ),
      );
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async function handleToggleActive(id, active) {
    try {
      const updated = await toggleActivityActive(id, active);
      setActivities((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async function handleDeleteActivity(id) {
    try {
      await deleteActivity(id);
      setActivities((prev) =>
        prev.filter((a) => a.id !== id),
      );
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  return {
    activities,
    loading,
    error,
    handleCreateActivity,
    handleUpdateActivity,
    handleToggleActive,
    handleDeleteActivity,
  };
}
