import { createContext, useContext, useState, useEffect, useRef } from "react";
import { getGym } from "../services/gym.service";
import { getCached } from "../utils/cache";

export const FeatureContext = createContext({ features: {} });

function FeatureProvider({ mode, initialFeatures, onRefreshFeatures, children }) {
  const [features, setFeatures] = useState({});
  const onRefreshFeaturesRef = useRef(onRefreshFeatures);
  onRefreshFeaturesRef.current = onRefreshFeatures;

  useEffect(() => {
    function refreshFeatures() {
      if (mode === "admin") {
        const token = localStorage.getItem("token");
        if (!token) {
          setFeatures({});
          return;
        }
        const cachedGym = getCached("gym");
        if (cachedGym?.features) {
          setFeatures(cachedGym.features);
          return;
        }
        getGym()
          .then((gym) => setFeatures(gym.features || {}))
          .catch(() => setFeatures({}));
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

    if (mode === "public") {
      setFeatures(initialFeatures || {});
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
