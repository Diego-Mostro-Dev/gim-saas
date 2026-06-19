import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";

import { getScheduleChangeRequests } from "../services/attendance.service";

let lastRefreshTime = 0;

export function getScheduleChangesLastRefresh() {
  return lastRefreshTime;
}

export function useScheduleChangeWatcher() {
  const location = useLocation();
  const prevRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!location.pathname.includes("/schedule-change-requests")) {
      console.log("[SCHEDULE-CHANGE-WATCHER] SKIP — pathname does not match", location.pathname);
      return;
    }

    console.log("[SCHEDULE-CHANGE-WATCHER] MOUNTED, starting poll cycle");

    async function check() {
      console.log("[SCHEDULE-CHANGE-WATCHER] POLL EXECUTED");
      if (document.visibilityState !== "visible") {
        console.log("[SCHEDULE-CHANGE-WATCHER] SKIP — tab not visible");
        return;
      }

      if (Date.now() - lastRefreshTime < 60000) {
        console.log("[SCHEDULE-CHANGE-WATCHER] SKIP — rate limit", { lastRefreshTime });
        return;
      }
      lastRefreshTime = Date.now();

      try {
        console.log("[SCHEDULE-CHANGE-WATCHER] FETCHING from API...");
        const current = await getScheduleChangeRequests();
        console.log("[SCHEDULE-CHANGE-WATCHER] API RESPONSE", {
          dataType: typeof current,
          isArray: Array.isArray(current),
          count: Array.isArray(current) ? current.length : 'N/A',
          isNull: current === null,
          isUndefined: current === undefined,
        });

        if (current === undefined || current === null) {
          console.log("[SCHEDULE-CHANGE-WATCHER] SKIP — API returned null/undefined (possible 401 redirect)");
          return;
        }

        if (!initialized.current) {
          console.log("[SCHEDULE-CHANGE-WATCHER] FIRST RUN — storing initial snapshot", {
            idList: Array.isArray(current) ? current.map(r => r.id) : [],
          });
          initialized.current = true;
          prevRef.current = current;

          console.log("[SCHEDULE-CHANGE-WATCHER] DISPATCHING event (initial)");
          window.dispatchEvent(
            new CustomEvent("schedule-changes-refreshed", { detail: current }),
          );

          return;
        }

        const prev = prevRef.current;
        if (!prev) {
          console.log("[SCHEDULE-CHANGE-WATCHER] No prev snapshot, storing current");
          prevRef.current = current;
          return;
        }

        console.log("[SCHEDULE-CHANGE-WATCHER] COMPARING prev vs current", {
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
            console.log("[SCHEDULE-CHANGE-WATCHER] DIFF DETECTED: new request", {
              id: req.id,
              member: req.member_name,
            });
            toast.success(
              `Nuevo cambio permanente: ${req.member_name}`,
              { id: `scr-new-${req.id}` },
            );
          }
        }

        for (const req of current) {
          const prevReq = prevMap.get(req.id);
          if (prevReq && prevReq.status !== req.status) {
            statusChangedFound++;
            const label =
              req.status === "approved"
                ? "aprobado"
                : req.status === "rejected"
                  ? "rechazado"
                  : "cancelado";
            console.log("[SCHEDULE-CHANGE-WATCHER] DIFF DETECTED: status change", {
              id: req.id,
              member: req.member_name,
              from: prevReq.status,
              to: req.status,
            });
            toast.success(
              `Cambio permanente ${label}: ${req.member_name}`,
              { id: `scr-status-${req.id}-${req.status}` },
            );
          }
        }

        if (newRequestsFound === 0 && statusChangedFound === 0) {
          console.log("[SCHEDULE-CHANGE-WATCHER] NO DIFF — data unchanged");
        }

        prevRef.current = current;

        console.log("[SCHEDULE-CHANGE-WATCHER] DISPATCHING event (refresh)");
        window.dispatchEvent(
          new CustomEvent("schedule-changes-refreshed", { detail: current }),
        );
      } catch (err) {
        console.log("[SCHEDULE-CHANGE-WATCHER] CAUGHT ERROR", {
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
