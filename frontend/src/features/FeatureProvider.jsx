import { createContext, useContext, useState, useEffect, useRef } from "react";
import { getGym } from "../services/gym.service";

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
        getGym()
          .then((gym) => setFeatures(gym.features || {}))
          .catch(() => setFeatures({}));
      } else if (mode === "public") {
        onRefreshFeaturesRef.current?.();
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

    window.addEventListener("features:updated", handleFeaturesRefresh);
    window.addEventListener("focus", handleFeaturesRefresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("features:updated", handleFeaturesRefresh);
      window.removeEventListener("focus", handleFeaturesRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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
