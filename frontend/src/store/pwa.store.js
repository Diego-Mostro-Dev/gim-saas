import { create } from "zustand";

const BUILD_ID_KEY = "__pwa_build__";

function getStoredBuildId() {
  try {
    return localStorage.getItem(BUILD_ID_KEY);
  } catch {
    return null;
  }
}

function persistBuildId(id) {
  try {
    localStorage.setItem(BUILD_ID_KEY, id);
  } catch {}
}

const usePWAStore = create((set, get) => ({
  updateAvailable: false,
  offlineReady: false,
  _isUpdating: false,
  currentBuildId: __BUILD_ID__,
  previousBuildId: getStoredBuildId(),
  appVersion: __APP_VERSION__,
  _updateSW: null,

  canInstall: false,
  installEvent: null,
  installed: false,

  setUpdateSW: (fn) => set({ _updateSW: fn }),
  setCanInstall: (can, event) =>
    set({ canInstall: can, installEvent: event || null }),
  setInstalled: () =>
    set({ canInstall: false, installEvent: null, installed: true }),
  notifyUpdateAvailable: () => set({ updateAvailable: true }),
  notifyOfflineReady: () => set({ offlineReady: true }),
  dismissUpdate: () => set({ updateAvailable: false, offlineReady: false }),

  forceUpdate: () => {
    const state = get();
    if (state._isUpdating || !state._updateSW) return;
    set({ _isUpdating: true, updateAvailable: false });
    drainWorkboxCaches();
    persistBuildId(__BUILD_ID__);
    state._updateSW();
  },

  applyUpdate: () => {
    const state = get();
    if (state._isUpdating || !state._updateSW) return;
    set({ _isUpdating: true, updateAvailable: false });
    drainWorkboxCaches();
    persistBuildId(__BUILD_ID__);
    state._updateSW();
  },
}));

function drainWorkboxCaches() {
  if (typeof caches === "undefined") return;
  caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (key.startsWith("workbox-")) {
        caches.delete(key).catch(() => {});
      }
    });
  });
}

if (typeof window !== "undefined") {
  window.__APP_VERSION__ = __APP_VERSION__;
  window.__BUILD_ID__ = __BUILD_ID__;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    usePWAStore.getState().setCanInstall(true, event);
  });

  window.addEventListener("appinstalled", () => {
    usePWAStore.getState().setInstalled();
  });
}

const prevBuildId = getStoredBuildId();
if (prevBuildId && prevBuildId !== __BUILD_ID__) {
  console.log(`[PWA] Build changed: ${prevBuildId} -> ${__BUILD_ID__}`);
  drainWorkboxCaches();
}
persistBuildId(__BUILD_ID__);

export default usePWAStore;
