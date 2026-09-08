import { useEffect, useState } from "react";
import { getClosedDates } from "../services/gym.service";

export function useClosedDates() {
  const [closedDates, setClosedDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    function load() {
      getClosedDates()
        .then((data) => {
          if (active) setClosedDates(data);
        })
        .catch(() => {
          if (active) setError("Error cargando las fechas cerradas.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    load();
    window.addEventListener("closed-dates:updated", load);

    return () => {
      active = false;
      window.removeEventListener("closed-dates:updated", load);
    };
  }, []);

  return { closedDates, loading, error };
}