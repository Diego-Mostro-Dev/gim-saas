import { createContext, useContext, useState, useEffect } from "react";
import { getGym } from "../services/gym.service";

const FeatureContext = createContext({ features: {} });

function FeatureProvider({ mode, initialFeatures, children }) {
  const [features, setFeatures] = useState({});

  useEffect(() => {
    if (mode === "public") {
      setFeatures(initialFeatures || {});
      return;
    }

    if (mode === "admin") {
      const token = localStorage.getItem("token");
      if (!token) {
        setFeatures({});
        return;
      }

      getGym()
        .then((gym) => setFeatures(gym.features || {}))
        .catch(() => setFeatures({}));
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
