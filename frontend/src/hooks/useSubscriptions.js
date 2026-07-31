import { useEffect, useState } from "react";

import { getSubscriptions } from "../services/subscriptions.service";

import { getMembers } from "../services/members.service";

import { getPlans } from "../services/plans.service";
import { getCached, isCacheFresh } from "../utils/cache";

function allCacheFresh() {
  return (
    isCacheFresh("subscriptions", 2 * 60 * 1000) &&
    isCacheFresh("members", 5 * 60 * 1000) &&
    isCacheFresh("plans", 30 * 60 * 1000)
  );
}

function initFromCache() {
  return {
    subscriptions: getCached("subscriptions") || [],
    members: getCached("members") || [],
    plans: getCached("plans") || [],
  };
}

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState(() =>
    isCacheFresh("subscriptions", 2 * 60 * 1000) ? getCached("subscriptions") || [] : []
  );

  const [members, setMembers] = useState(() =>
    isCacheFresh("members", 5 * 60 * 1000) ? getCached("members") || [] : []
  );

  const [plans, setPlans] = useState(() =>
    isCacheFresh("plans", 30 * 60 * 1000) ? getCached("plans") || [] : []
  );

  const [loading, setLoading] = useState(() => !allCacheFresh());

  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (allCacheFresh()) {
      const cached = initFromCache();
      setSubscriptions(cached.subscriptions);
      setMembers(cached.members);
      setPlans(cached.plans);
      setLoading(false);
      setError(null);
      return;
    }
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

  return {
    subscriptions,
    members,
    plans,
    loading,
    error,
  };
}
