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

        console.log("[WATCHER POLL] schedule-change", {
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

          console.log("[WATCHER EVENT DISPATCHED] schedule-changes-refreshed (initial)");
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

        console.log("[WATCHER DIFF] schedule-change", {
          added: current.filter((r) => !prevMap.has(r.id)).map((r) => r.id),
          removed: prev.filter((r) => !new Map(current.map((c) => [c.id, c])).has(r.id)).map((r) => r.id),
          changed: current.filter((r) => prevMap.has(r.id) && prevMap.get(r.id).status !== r.status).map((r) => ({ id: r.id, to: r.status })),
        });

        prevRef.current = current;

        console.log("[WATCHER EVENT DISPATCHED] schedule-changes-refreshed");
        window.dispatchEvent(
          new CustomEvent("schedule-changes-refreshed", { detail: current }),
        );
      } catch (err) {
        console.log("[WATCHER ERROR] schedule-change", { name: err?.name, message: err?.message });
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
