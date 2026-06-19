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

        console.log("[WATCHER POLL] schedule-swap", {
          initialized: initialized.current,
          previousCount: Array.isArray(prevRef.current) ? prevRef.current.length : prevRef.current,
          currentCount: Array.isArray(current) ? current.length : typeof current,
        });

        if (current === undefined || current === null) {
          return;
        }

        if (!initialized.current) {
          initialized.current = true;
          prevRef.current = current;

          console.log("[WATCHER EVENT DISPATCHED] schedule-swaps-refreshed (initial)");
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

        console.log("[WATCHER DIFF] schedule-swap", {
          added: current.filter((r) => !prevMap.has(r.id)).map((r) => r.id),
          removed: prev.filter((r) => !new Map(current.map((c) => [c.id, c])).has(r.id)).map((r) => r.id),
          changed: current.filter((r) => prevMap.has(r.id) && prevMap.get(r.id).status !== r.status).map((r) => ({ id: r.id, to: r.status })),
        });

        prevRef.current = current;

        console.log("[WATCHER EVENT DISPATCHED] schedule-swaps-refreshed");
        window.dispatchEvent(
          new CustomEvent("schedule-swaps-refreshed", { detail: current }),
        );
      } catch (err) {
        console.log("[WATCHER ERROR] schedule-swap", { name: err?.name, message: err?.message });
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
