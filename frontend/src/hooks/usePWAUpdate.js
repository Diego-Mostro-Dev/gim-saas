import { useCallback } from "react";
import usePWAStore from "../store/pwa.store";

export function usePWAUpdate() {
  const updateAvailable = usePWAStore((s) => s.updateAvailable);
  const offlineReady = usePWAStore((s) => s.offlineReady);
  const isUpdating = usePWAStore((s) => s._isUpdating);
  const previousBuildId = usePWAStore((s) => s.previousBuildId);
  const currentBuildId = usePWAStore((s) => s.currentBuildId);
  const appVersion = usePWAStore((s) => s.appVersion);
  const dismissUpdate = usePWAStore((s) => s.dismissUpdate);
  const applyUpdate = usePWAStore((s) => s.applyUpdate);

  return {
    updateAvailable,
    offlineReady,
    isUpdating,
    currentBuildId,
    previousBuildId,
    appVersion,
    dismissUpdate: useCallback(dismissUpdate, []),
    applyUpdate: useCallback(applyUpdate, []),
  };
}
