import { createContext, useContext, useState, useEffect, useRef } from "react";
import { getGym } from "../services/gym.service";
import { getCached } from "../utils/cache";
import useAuthStore from "../store/auth.store";

export const FeatureContext = createContext({ features: {} });

function FeatureProvider({ mode, initialFeatures, onRefreshFeatures, children }) {
  // In admin mode /api/auth/me/ already carries the gym's feature flags, and
  // the app only renders after hydrate() resolves — so seeding from the auth
  // store paints gated nav items (Actividades/Entrenam.) on the first frame
  // instead of a frame-plus-one-RTT later.
  const [features, setFeatures] = useState(() =>
    mode === "admin" ? (useAuthStore.getState().features || {}) : {},
  );
  const onRefreshFeaturesRef = useRef(onRefreshFeatures);
  onRefreshFeaturesRef.current = onRefreshFeatures;

  const authFeatures = useAuthStore((state) => state.features);

  useEffect(() => {
    if (mode === "public") {
      setFeatures(initialFeatures || {});
      return;
    }

    // The mount effect below never re-runs (its deps are constant), so
    // without this sync a fresh login would leave features as {} until the
    // window regains focus; logout clearing authFeatures also lands here.
    setFeatures(authFeatures || {});
  }, [mode, initialFeatures, authFeatures]);

  useEffect(() => {
    function refreshFeatures() {
      if (mode === "admin") {
        const token = localStorage.getItem("token");
        if (!token) {
          setFeatures({});
          return;
        }
        // Stale-while-revalidate: paint from the cache (or the auth seed)
        // right away, then refresh in the background. useGym() no longer
        // revalidates on every mount, so this is what keeps gym data fresh
        // on focus/visibility; a failed refresh must keep the last known
        // flags instead of wiping the nav.
        const cachedGym = getCached("gym");
        if (cachedGym?.features) {
          setFeatures(cachedGym.features);
        }
        getGym()
          .then((gym) => setFeatures(gym.features || {}))
          .catch(() => {});
      } else if (mode === "public") {
        Promise.resolve(onRefreshFeaturesRef.current?.())
          .then((refreshed) => {
            if (refreshed?.gym?.features) {
              setFeatures(refreshed.gym.features);
            }
          })
          .catch(() => {});
      }
    }

    if (mode === "admin") {
      refreshFeatures();
    }

    function handleFeaturesRefresh() {
      refreshFeatures();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        handleFeaturesRefresh();
      }
    }

    if (mode === "admin") {
      window.addEventListener("features:updated", handleFeaturesRefresh);
      window.addEventListener("focus", handleFeaturesRefresh);
      document.addEventListener("visibilitychange", onVisibilityChange);

      return () => {
        window.removeEventListener("features:updated", handleFeaturesRefresh);
        window.removeEventListener("focus", handleFeaturesRefresh);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };
    }
  }, [mode, initialFeatures]);

  return (
    <FeatureContext.Provider value={{ features }}>
      {children}
    </FeatureContext.Provider>
  );
}

function useFeature(name) {
  const { features } = useContext(FeatureContext);
  return !!features?.[name];
}

export { FeatureProvider, useFeature };
