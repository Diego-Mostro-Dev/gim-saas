import { useState, useEffect } from "react";

export function useScheduleSwapData() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    function onRefreshed(e) {
      setRequests(e.detail);
    }

    window.addEventListener("schedule-swaps-refreshed", onRefreshed);
    return () => window.removeEventListener("schedule-swaps-refreshed", onRefreshed);
  }, []);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return { requests, pendingCount };
}
