import { useState, useEffect } from "react";

export function usePlanChangeData() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    function onRefreshed(e) {
      console.log("[DATA HOOK EVENT RECEIVED] plan-changes-refreshed", {
        requestCount: Array.isArray(e.detail) ? e.detail.length : typeof e.detail,
        pendingCount: Array.isArray(e.detail) ? e.detail.filter((r) => r.status === "pending").length : 0,
      });
      setRequests(e.detail);
    }

    window.addEventListener("plan-changes-refreshed", onRefreshed);
    return () => window.removeEventListener("plan-changes-refreshed", onRefreshed);
  }, []);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return { requests, pendingCount };
}
