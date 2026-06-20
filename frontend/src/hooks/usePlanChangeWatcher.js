import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

import { getPlanChangeRequests } from "../services/plan-change-requests.service";

let lastRefreshTime = 0;

export function getPlanChangesLastRefresh() {
  return lastRefreshTime;
}

export function usePlanChangeWatcher() {
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
        const current = await getPlanChangeRequests();

        if (current === undefined || current === null) {
          return;
        }

        if (!initialized.current) {
          initialized.current = true;
          prevRef.current = current;

          window.dispatchEvent(
            new CustomEvent("plan-changes-refreshed", { detail: current }),
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
              `Nuevo cambio de plan: ${req.member_name}`,
              { id: `pcr-new-${req.id}` },
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
              `Cambio de plan ${label}: ${req.member_name}`,
              { id: `pcr-status-${req.id}-${req.status}` },
            );
          }
        }

        prevRef.current = current;
        window.dispatchEvent(
          new CustomEvent("plan-changes-refreshed", { detail: current }),
        );
      } catch (err) {
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
