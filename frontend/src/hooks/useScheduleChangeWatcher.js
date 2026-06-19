import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

import { getScheduleChangeRequests } from "../services/attendance.service";

let lastRefreshTime = 0;

export function getScheduleChangesLastRefresh() {
  return lastRefreshTime;
}

export function useScheduleChangeWatcher() {
  const prevRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    async function check() {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (Date.now() - lastRefreshTime < 60000) {
        return;
      }
      lastRefreshTime = Date.now();

      try {
        const current = await getScheduleChangeRequests();

        if (current === undefined || current === null) {
          return;
        }

        if (!initialized.current) {
          initialized.current = true;
          prevRef.current = current;

          window.dispatchEvent(
            new CustomEvent("schedule-changes-refreshed", { detail: current }),
          );

          return;
        }

        const prev = prevRef.current;
        if (!prev) {
          prevRef.current = current;
          return;
        }

        const prevMap = new Map(prev.map((r) => [r.id, r]));

        for (const req of current) {
          if (!prevMap.has(req.id)) {
            toast.success(
              `Nuevo cambio permanente: ${req.member_name}`,
              { id: `scr-new-${req.id}` },
            );
          }
        }

        for (const req of current) {
          const prevReq = prevMap.get(req.id);
          if (prevReq && prevReq.status !== req.status) {
            const label =
              req.status === "approved"
                ? "aprobado"
                : req.status === "rejected"
                  ? "rechazado"
                  : "cancelado";
            toast.success(
              `Cambio permanente ${label}: ${req.member_name}`,
              { id: `scr-status-${req.id}-${req.status}` },
            );
          }
        }

        prevRef.current = current;

        window.dispatchEvent(
          new CustomEvent("schedule-changes-refreshed", { detail: current }),
        );
      } catch {
        // ignore polling errors
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        check();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    check();

    const interval = setInterval(check, 1 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
    };
  }, []);
}
