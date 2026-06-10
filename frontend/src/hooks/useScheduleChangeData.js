import { useState, useEffect } from "react";

export function useScheduleChangeData() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    function onRefreshed(e) {
      setRequests(e.detail);
    }

    window.addEventListener("schedule-changes-refreshed", onRefreshed);
    return () => window.removeEventListener("schedule-changes-refreshed", onRefreshed);
  }, []);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return { requests, pendingCount };
}
