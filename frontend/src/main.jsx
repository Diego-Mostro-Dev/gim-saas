import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import useAuthStore from "./store/auth.store";
import usePWAStore from "./store/pwa.store";
import { ThemeProvider } from "./context/ThemeContext";
import { FeatureProvider } from "./features/FeatureProvider";
import UpdateBanner from "./components/UpdateBanner";
import InstallBanner from "./components/InstallBanner";
import { registerSW } from "virtual:pwa-register";
import { STAFF_MANIFEST, MEMBER_MANIFEST, memberManifestHref, resolveManifestHref, setManifestHref } from "./utils/manifest";

import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const root = ReactDOM.createRoot(document.getElementById("root"));

const pathname = window.location.pathname;
const memberToken = pathname.startsWith("/routine/")
  ? pathname.split("/")[2]
  : null;
resolveManifestHref(
  memberToken ? memberManifestHref(memberToken) : null,
  memberToken ? MEMBER_MANIFEST : STAFF_MANIFEST,
).then(setManifestHref);

useAuthStore.getState().hydrate().then(() => {
  const updateSW = registerSW({
    onNeedRefresh() {
      usePWAStore.getState().setUpdateSW(() => updateSW(true));
      usePWAStore.getState().notifyUpdateAvailable();
    },
    onOfflineReady() {
      usePWAStore.getState().notifyOfflineReady();
    },
    onRegistered(registration) {
      console.log(
        `[PWA] SW registrado | v${__APP_VERSION__} build:${__BUILD_ID__}`,
      );

      if (registration?.active) {
        registration.update();
      }
    },
    onRegisterError(error) {
      console.error("[PWA] Error al registrar SW:", error);
    },
  });

  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <FeatureProvider mode="admin">
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </FeatureProvider>
            <UpdateBanner />
            <InstallBanner />
            <Toaster position="top-center" />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
});
