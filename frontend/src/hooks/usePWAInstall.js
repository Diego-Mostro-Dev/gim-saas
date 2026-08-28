import usePWAStore from "../store/pwa.store";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const iPadOS =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || iPadOS;
}

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return window.navigator.standalone === true;
}

export function usePWAInstall() {
  const canInstall = usePWAStore((s) => s.canInstall);
  const installEvent = usePWAStore((s) => s.installEvent);
  const installed = usePWAStore((s) => s.installed);
  const setCanInstall = usePWAStore((s) => s.setCanInstall);
  const setInstalled = usePWAStore((s) => s.setInstalled);

  async function promptInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice?.outcome === "accepted") {
      setInstalled();
    } else {
      setCanInstall(false, null);
    }
  }

  return {
    canInstall,
    installed,
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isStandalone: isStandalone(),
    promptInstall,
  };
}