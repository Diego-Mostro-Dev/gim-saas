import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

import { getScheduleSwapRequests } from "../services/attendance.service";

let lastRefreshTime = 0;

export function getScheduleSwapsLastRefresh() {
  return lastRefreshTime;
}

export function useScheduleSwapWatcher() {
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
        const current = await getScheduleSwapRequests();

        if (current === undefined || current === null) {
          return;
        }

        if (!initialized.current) {
          initialized.current = true;
          prevRef.current = current;

          window.dispatchEvent(
            new CustomEvent("schedule-swaps-refreshed", { detail: current }),
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
              `Nuevo intercambio: ${req.member_name}`,
              { id: `ssr-new-${req.id}` },
            );
          }
        }

        for (const req of current) {
          const prevReq = prevMap.get(req.id);
          if (prevReq && prevReq.status !== req.status) {
            let message;
            if (req.status === "approved") {
              message = `Tu intercambio fue aprobado.`;
            } else if (req.status === "rejected") {
              message = `Tu intercambio fue rechazado.`;
            } else {
              message = `Intercambio cancelado: ${req.member_name}`;
            }
            toast.success(message, {
              id: `ssr-status-${req.id}-${req.status}`,
            });
          }
        }

        prevRef.current = current;

        window.dispatchEvent(
          new CustomEvent("schedule-swaps-refreshed", { detail: current }),
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
