import { useEffect, useState } from "react";

import {
  getExercises,
  createExercise,
  updateExercise,
  deleteExercise,
} from "../services/routines.service";

export function useExercises() {
  const [exercises, setExercises] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  useEffect(() => {
    loadExercises();
  }, []);

  async function loadExercises() {
    try {
      setLoading(true);
      setError(null);

      const data = await getExercises();

      setExercises(data);
    } catch (err) {
      console.error(err);

      setError(
        "No se pudieron cargar los ejercicios"
      );
    } finally {
      setLoading(false);
    }
  }

  async function addExercise(payload) {
    const created = await createExercise(payload);

    setExercises((prev) => [
      created,
      ...prev,
    ]);

    return created;
  }

  async function editExercise(id, payload) {
    const updated = await updateExercise(
      id,
      payload
    );

    setExercises((prev) =>
      prev.map((item) =>
        item.id === id ? updated : item
      )
    );

    return updated;
  }

  async function removeExercise(id) {
    await deleteExercise(id);

    setExercises((prev) =>
      prev.filter((item) => item.id !== id)
    );
  }

  return {
    exercises,
    loading,
    error,
    loadExercises,
    addExercise,
    editExercise,
    removeExercise,
  };
}