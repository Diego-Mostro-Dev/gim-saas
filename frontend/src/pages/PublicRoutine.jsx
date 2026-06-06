import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getPublicRoutine } from "../services/routines.service";

function PublicRoutine() {
  const { token } = useParams();

  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRoutine();
  }, [token]);

  async function loadRoutine() {
    try {
      setLoading(true);

      const data = await getPublicRoutine(token);

      setRoutine(data);
    } catch (err) {
      console.error(err);

      setError("No se encontró la rutina.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#161616] text-white">
        Cargando rutina...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#161616] text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#161616] p-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 rounded-2xl bg-[#201f1f] p-6">
          <h1 className="text-2xl font-bold text-white">
            {routine.member_name}
          </h1>

          <p className="mt-2 text-zinc-400">{routine.routine_name}</p>
        </div>

        <div className="space-y-3">
          {routine.exercises?.map((exercise) => (
            <div key={exercise.id} className="rounded-2xl bg-[#201f1f] p-4">
              <h2 className="font-semibold text-white">{exercise.name}</h2>

              <p className="mt-2 text-zinc-400">
                {exercise.sets} series • {exercise.reps}
              </p>

              {exercise.weight && (
                <p className="mt-1 text-blue-300">Peso: {exercise.weight} kg</p>
              )}

              {exercise.notes && (
                <p className="mt-1 text-zinc-500">{exercise.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PublicRoutine;
