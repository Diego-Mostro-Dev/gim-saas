import { useEffect, useState } from "react";

import {
  getSubscriptions,
  createSubscription,
  deleteSubscription,
  updateSubscription,
} from "../services/subscriptions.service";

import { getMembers } from "../services/members.service";

import { getPlans } from "../services/plans.service";

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);

  const [members, setMembers] = useState([]);

  const [plans, setPlans] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      setError(null);

      const [
        subscriptionsData,
        membersData,
        plansData,
      ] = await Promise.all([
        getSubscriptions(),
        getMembers(),
        getPlans(),
      ]);

      setSubscriptions(subscriptionsData);

      setMembers(membersData);

      setPlans(plansData);
    } catch (error) {
      console.error(error);

      setError(
        "Error al cargar subscriptions",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createNewSubscription(
    formData,
  ) {
    try {
      const newSubscription =
        await createSubscription(formData);

      setSubscriptions((prev) => [
        newSubscription,
        ...prev,
      ]);

      return {
        success: true,
      };
    } catch (error) {
      console.error(error);

      return {
        success: false,
      };
    }
  }

  async function editSubscription(
    id,
    formData,
  ) {
    try {
      const updatedSubscription =
        await updateSubscription(id, formData);

      setSubscriptions((prev) =>
        prev.map((subscription) =>
          subscription.id === updatedSubscription.id
            ? updatedSubscription
            : subscription,
        ),
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error(error);

      return {
        success: false,
      };
    }
  }

  async function removeSubscription(id) {
    try {
      await deleteSubscription(id);

      setSubscriptions((prev) =>
        prev.filter(
          (subscription) =>
            subscription.id !== id,
        ),
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error(error);

      return {
        success: false,
      };
    }
  }

  return {
    subscriptions,
    members,
    plans,
    loading,
    error,

    createNewSubscription,
    editSubscription,
    removeSubscription,
  };
}