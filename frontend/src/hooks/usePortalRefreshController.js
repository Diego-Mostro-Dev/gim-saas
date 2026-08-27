import { useCallback, useEffect, useRef } from "react";

const TIMER_INTERVAL_MS = 15 * 60 * 1000;
const RETURN_MIN_INTERVAL_MS = 2 * 60 * 1000;

export function usePortalRefreshController({ refresh, initialLoad }) {
  const refreshRef = useRef(refresh);
  const initialLoadRef = useRef(initialLoad);

  const isRefreshingRef = useRef(false);
  const currentCycleRef = useRef(null);
  const trailingForceRef = useRef(false);
  const lastCompletedAtRef = useRef(0);

  useEffect(() => {
    refreshRef.current = refresh;
    initialLoadRef.current = initialLoad;
  });

  const runLocked = useCallback(async (fn) => {
    try {
      isRefreshingRef.current = true;
      return await fn();
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  const executeCycles = useCallback(
    async (task) => {
      do {
        trailingForceRef.current = false;
        await runLocked(async () => {
          try {
            await task();
          } finally {
            lastCompletedAtRef.current = Date.now();
          }
        });
      } while (trailingForceRef.current);
    },
    [runLocked],
  );

  const runCycle = useCallback(() => {
    const loop = executeCycles(() => refreshRef.current());
    loop.catch(() => {});
    currentCycleRef.current = loop;
    return loop;
  }, [executeCycles]);

  const request = useCallback(
    ({ cause = "manual", force = false } = {}) => {
      if (isRefreshingRef.current) {
        if (force) {
          trailingForceRef.current = true;
        }
        return currentCycleRef.current ?? Promise.resolve();
      }

      if (cause !== "manual" && document.visibilityState !== "visible") {
        return Promise.resolve();
      }

      if (!force) {
        const minInterval =
          cause === "timer"
            ? TIMER_INTERVAL_MS
            : cause === "return"
              ? RETURN_MIN_INTERVAL_MS
              : 0;
        if (Date.now() - lastCompletedAtRef.current < minInterval) {
          return Promise.resolve();
        }
      }

      return runCycle();
    },
    [runCycle],
  );

  const runInitialLoad = useCallback(async () => {
    while (isRefreshingRef.current) {
      await currentCycleRef.current?.catch(() => {});
    }
    const promise = executeCycles(() => initialLoadRef.current());
    currentCycleRef.current = promise;
    await promise;
  }, [executeCycles]);

  useEffect(() => {
    function handleReturn() {
      request({ cause: "return" });
    }

    function handleTimerTick() {
      request({ cause: "timer" });
    }

    document.addEventListener("visibilitychange", handleReturn);
    window.addEventListener("focus", handleReturn);
    const interval = setInterval(handleTimerTick, TIMER_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", handleReturn);
      window.removeEventListener("focus", handleReturn);
      clearInterval(interval);
    };
  }, [request]);

  return { request, runInitialLoad };
}
