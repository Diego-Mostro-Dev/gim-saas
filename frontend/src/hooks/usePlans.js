import { useEffect, useState } from "react";

import {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
} from "../services/plans.service";

export function usePlans() {
  const [plans, setPlans] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
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