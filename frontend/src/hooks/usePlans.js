import { useEffect, useState } from "react";

import {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
} from "../services/plans.service";
import { getCached, isCacheFresh } from "../utils/cache";

const CACHE_KEY = "plans";
const TTL = 30 * 60 * 1000;

export function usePlans() {
  const [plans, setPlans] = useState(() => getCached(CACHE_KEY) || []);

  const [loading, setLoading] = useState(() => !isCacheFresh(CACHE_KEY, TTL));

  const [error, setError] = useState(null);

  async function loadPlans() {
    if (isCacheFresh(CACHE_KEY, TTL)) {
      setPlans(getCached(CACHE_KEY));
      setLoading(false);
      setError(null);
      try {
        const data = await getPlans();
        setPlans(data);
      } catch (err) {
        console.error(err);
      }
      return;
    }
    try {
      setLoading(true);

      setError(null);

      const data = await getPlans();

      setPlans(data);
    } catch (err) {
      console.error(err);

      setError("Error al cargar planes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  async function handleCreatePlan(data) {
    try {
      const newPlan = await createPlan(data);

      setPlans((prev) => [newPlan, ...prev]);
    } catch (err) {
      console.error(err);

      throw err;
    }
  }

  async function handleUpdatePlan(id, data) {
    try {
      const updatedPlan = await updatePlan(id, data);

      setPlans((prev) =>
        prev.map((plan) =>
          plan.id === updatedPlan.id
            ? updatedPlan
            : plan,
        ),
      );
    } catch (err) {
      console.error(err);

      throw err;
    }
  }

  async function handleDeletePlan(id) {
    try {
      await deletePlan(id);

      setPlans((prev) =>
        prev.filter((plan) => plan.id !== id),
      );
    } catch (err) {
      console.error(err);

      throw err;
    }
  }

  return {
    plans,
    loading,
    error,
    handleCreatePlan,
    handleUpdatePlan,
    handleDeletePlan,
  };
}
