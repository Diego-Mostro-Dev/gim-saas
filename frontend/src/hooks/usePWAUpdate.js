import { useCallback } from "react";
import usePWAStore from "../store/pwa.store";

export function usePWAUpdate() {
  const updateAvailable = usePWAStore((s) => s.updateAvailable);
  const isUpdating = usePWAStore((s) => s._isUpdating);
  const previousBuildId = usePWAStore((s) => s.previousBuildId);
  const currentBuildId = usePWAStore((s) => s.currentBuildId);
  const appVersion = usePWAStore((s) => s.appVersion);
  const dismissUpdate = usePWAStore((s) => s.dismissUpdate);
  const applyUpdate = usePWAStore((s) => s.applyUpdate);

  const stableDismiss = useCallback(() => dismissUpdate(), [dismissUpdate]);
  const stableApply = useCallback(() => applyUpdate(), [applyUpdate]);

  return {
    updateAvailable,
    isUpdating,
    currentBuildId,
    previousBuildId,
    appVersion,
    dismissUpdate: stableDismiss,
    applyUpdate: stableApply,
  };
}
