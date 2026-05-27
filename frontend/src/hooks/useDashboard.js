import { useEffect, useState } from "react";

import { getDashboardData } from "../services/dashboard.service";

export function useDashboard() {
  const [dashboardData, setDashboardData] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
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
    error,
    reloadDashboard: loadDashboard,
  };
}