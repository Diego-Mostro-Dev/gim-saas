import { useEffect, useState } from "react";

import {
  getRoutineExercises,
  createRoutineExercise,
} from "../services/routines.service";

export function useRoutineExercises() {
  const [routineExercises, setRoutineExercises] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);

  useEffect(() => {
    loadRoutineExercises();
  }, []);

  async function loadRoutineExercises() {
    try {
      setLoading(true);

      const data =
        await getRoutineExercises();

      setRoutineExercises(data);
    } catch (error) {
      console.error(error);

      setError(
        "No se pudieron cargar los ejercicios de rutina",
      );
    } finally {
      setLoading(false);
    }
  }

  async function addRoutineExercise(data) {
    const created =
      await createRoutineExercise(data);

    setRoutineExercises((prev) => [
      ...prev,
      created,
    ]);

    return created;
  }

  return {
    routineExercises,
    loading,
    error,
    addRoutineExercise,
    reloadRoutineExercises:
      loadRoutineExercises,
  };
}