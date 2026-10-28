import { useCallback, useEffect, useState } from "react";

import { getDashboardData } from "../services/dashboard.service";
import { getCached, isCacheFresh, clearCached } from "../utils/cache";

const CACHE_KEY = "dashboard";
const TTL = 60 * 1000;

export function useDashboard() {
  const [dashboardData, setDashboardData] =
    useState(() => getCached(CACHE_KEY) || null);

  const [loading, setLoading] =
    useState(() => !isCacheFresh(CACHE_KEY, TTL));

  const [error, setError] =
    useState(null);

  const loadDashboard = useCallback(async () => {
    if (isCacheFresh(CACHE_KEY, TTL)) {
      setDashboardData(getCached(CACHE_KEY));
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await getDashboardData();
      setDashboardData(data);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadDashboard();
    });

    function onDashboardRefresh() {
      clearCached(CACHE_KEY);
      loadDashboard();
    }

    window.addEventListener("dashboard-refresh", onDashboardRefresh);
    return () => window.removeEventListener("dashboard-refresh", onDashboardRefresh);
  }, [loadDashboard]);

  return {
    dashboardData,
    loading,
    error,
  };
}