import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";

import { getScheduleSwapRequests } from "../services/attendance.service";

let lastRefreshTime = 0;

export function getScheduleSwapsLastRefresh() {
  return lastRefreshTime;
}

export function useScheduleSwapWatcher() {
  const location = useLocation();
  const prevRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!location.pathname.includes("/schedule-swap-requests")) {
      console.log("[SWAP-WATCHER] SKIP — pathname does not match", location.pathname);
      return;
    }

    console.log("[SWAP-WATCHER] MOUNTED, starting poll cycle");

    async function check() {
      console.log("[SWAP-WATCHER] POLL EXECUTED");
      if (document.visibilityState !== "visible") {
        console.log("[SWAP-WATCHER] SKIP — tab not visible");
        return;
      }

      if (Date.now() - lastRefreshTime < 60000) {
        console.log("[SWAP-WATCHER] SKIP — rate limit", { lastRefreshTime });
        return;
      }
      lastRefreshTime = Date.now();

      try {
        console.log("[SWAP-WATCHER] FETCHING from API...");
        const current = await getScheduleSwapRequests();
        console.log("[SWAP-WATCHER] API RESPONSE", {
          dataType: typeof current,
          isArray: Array.isArray(current),
          count: Array.isArray(current) ? current.length : 'N/A',
          isNull: current === null,
          isUndefined: current === undefined,
        });

        if (current === undefined || current === null) {
          console.log("[SWAP-WATCHER] SKIP — API returned null/undefined (possible 401 redirect)");
          return;
        }

        if (!initialized.current) {
          console.log("[SWAP-WATCHER] FIRST RUN — storing initial snapshot", {
            idList: Array.isArray(current) ? current.map(r => r.id) : [],
          });
          initialized.current = true;
          prevRef.current = current;

          console.log("[SWAP-WATCHER] DISPATCHING event (initial)");
          window.dispatchEvent(
            new CustomEvent("schedule-swaps-refreshed", { detail: current }),
          );

          return;
        }

        const prev = prevRef.current;
        if (!prev) {
          console.log("[SWAP-WATCHER] No prev snapshot, storing current");
          prevRef.current = current;
          return;
        }

        console.log("[SWAP-WATCHER] COMPARING prev vs current", {
          prevCount: prev.length,
          currentCount: current.length,
          prevIds: prev.map(r => r.id),
          currentIds: current.map(r => r.id),
        });

        const prevMap = new Map(prev.map((r) => [r.id, r]));

        let newRequestsFound = 0;
        let statusChangedFound = 0;

        for (const req of current) {
          if (!prevMap.has(req.id)) {
            newRequestsFound++;
            console.log("[SWAP-WATCHER] DIFF DETECTED: new request", {
              id: req.id,
              member: req.member_name,
            });
            toast.success(
              `Nuevo intercambio: ${req.member_name}`,
              { id: `ssr-new-${req.id}` },
            );
          }
        }

        for (const req of current) {
          const prevReq = prevMap.get(req.id);
          if (prevReq && prevReq.status !== req.status) {
            statusChangedFound++;
            let message;
            if (req.status === "approved") {
              message = `Tu intercambio fue aprobado.`;
            } else if (req.status === "rejected") {
              message = `Tu intercambio fue rechazado.`;
            } else {
              message = `Intercambio cancelado: ${req.member_name}`;
            }
            console.log("[SWAP-WATCHER] DIFF DETECTED: status change", {
              id: req.id,
              member: req.member_name,
              from: prevReq.status,
              to: req.status,
            });
            toast.success(message, {
              id: `ssr-status-${req.id}-${req.status}`,
            });
          }
        }

        if (newRequestsFound === 0 && statusChangedFound === 0) {
          console.log("[SWAP-WATCHER] NO DIFF — data unchanged");
        }

        prevRef.current = current;

        console.log("[SWAP-WATCHER] DISPATCHING event (refresh)");
        window.dispatchEvent(
          new CustomEvent("schedule-swaps-refreshed", { detail: current }),
        );
      } catch (err) {
        console.log("[SWAP-WATCHER] CAUGHT ERROR", {
          name: err.name,
          message: err.message,
        });
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
  }, [location.pathname]);
}
