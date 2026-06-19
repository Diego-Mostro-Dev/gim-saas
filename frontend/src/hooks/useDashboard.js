import { useEffect, useState } from "react";

import { getDashboardData } from "../services/dashboard.service";
import { getCached, isCacheFresh, clearCached } from "../utils/cache";

const CACHE_KEY = "dashboard";
const TTL = 60 * 1000;

export function useDashboard() {
  const [dashboardData, setDashboardData] =
    useState(() => getCached(CACHE_KEY) || null);

  const [loading, setLoading] =
    useState(() => !isCacheFresh(CACHE_KEY, TTL));

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] =
    useState(null);

  useEffect(() => {
    loadDashboard();

    function onDashboardRefresh() {
      clearCached(CACHE_KEY);
      loadDashboard();
    }

    window.addEventListener("dashboard-refresh", onDashboardRefresh);
    return () => window.removeEventListener("dashboard-refresh", onDashboardRefresh);
  }, []);

  async function loadDashboard() {
    if (isCacheFresh(CACHE_KEY, TTL)) {
      setDashboardData(getCached(CACHE_KEY));
      setLoading(false);
      setError(null);
      setRefreshing(true);
      try {
        const data = await getDashboardData();
        setDashboardData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setRefreshing(false);
      }
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const data =
        await getDashboardData();

      setDashboardData(data);
    } catch (error) {
      console.error(error);

      setError(
        "No se pudo cargar el dashboard",
      );
    } finally {
      setLoading(false);
    }
  }

  return {
    dashboardData,
    loading,
    refreshing,
    error,
    reloadDashboard: loadDashboard,
  };
}