import { useState, useEffect } from "react";

export function usePlanChangeData() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    function onRefreshed(e) {
      setRequests(e.detail);
    }

    window.addEventListener("plan-changes-refreshed", onRefreshed);
    return () => window.removeEventListener("plan-changes-refreshed", onRefreshed);
  }, []);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return { requests, pendingCount };
}
