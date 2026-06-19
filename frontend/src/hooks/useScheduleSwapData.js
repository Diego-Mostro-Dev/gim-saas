import { useState, useEffect } from "react";

export function useScheduleSwapData() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    function onRefreshed(e) {
      console.log("[DATA HOOK EVENT RECEIVED] schedule-swaps-refreshed", {
        requestCount: Array.isArray(e.detail) ? e.detail.length : typeof e.detail,
        pendingCount: Array.isArray(e.detail) ? e.detail.filter((r) => r.status === "pending").length : 0,
      });
      setRequests(e.detail);
    }

    window.addEventListener("schedule-swaps-refreshed", onRefreshed);
    return () => window.removeEventListener("schedule-swaps-refreshed", onRefreshed);
  }, []);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return { requests, pendingCount };
}
