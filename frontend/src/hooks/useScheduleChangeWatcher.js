import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

import { getScheduleChangeRequests } from "../services/attendance.service";

export function useScheduleChangeWatcher() {
  const prevRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    async function check() {
      if (document.visibilityState !== "visible") return;

      try {
        const current = await getScheduleChangeRequests();

        if (!initialized.current) {
          initialized.current = true;
          prevRef.current = current;
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
              `Nueva solicitud de cambio: ${req.member_name}`,
              { id: `scr-new-${req.id}` },
            );
          }
        }

        for (const req of current) {
          const prevReq = prevMap.get(req.id);
          if (prevReq && prevReq.status !== req.status) {
            const label =
              req.status === "approved"
                ? "aprobada"
                : req.status === "rejected"
                  ? "rechazada"
                  : "cancelada";
            toast.success(
              `Solicitud ${label}: ${req.member_name}`,
              { id: `scr-status-${req.id}-${req.status}` },
            );
          }
        }

        prevRef.current = current;
      } catch {
        // silent — network errors are expected and handled elsewhere
      }
    }

    check();

    const interval = setInterval(check, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
}
