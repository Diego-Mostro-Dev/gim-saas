import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getPublicRoutine } from "../services/routines.service";

const DAY_NAMES = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
};

function PublicRoutine() {
  const { token } = useParams();

  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) {
      localStorage.setItem("member_token", token);
    }

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
        Cargando portal...
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

  const { member, gym, subscription, schedules } = routine;

  return (
    <div className="min-h-screen bg-[#161616] p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-2xl bg-[#201f1f] p-6">
          <p className="text-sm text-zinc-500">{gym.name}</p>

          <h1 className="mt-1 text-2xl font-bold text-white">
            {member.first_name} {member.last_name}
          </h1>
        </div>

        <div className="rounded-2xl bg-[#201f1f] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Suscripción
          </h2>

          {subscription ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Plan</span>
                <span className="text-white">{subscription.plan}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Inicio</span>
                <span className="text-white">{subscription.start_date}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Vencimiento</span>
                <span className="text-white">{subscription.end_date}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Estado</span>

                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    subscription.paid
                      ? "bg-green-500/10 text-green-400"
                      : "bg-yellow-500/10 text-yellow-300"
                  }`}
                >
                  {subscription.paid ? "Pagado" : "Pendiente"}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sin suscripción activa</p>
          )}
        </div>

        <div className="rounded-2xl bg-[#201f1f] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Horarios
          </h2>

          {schedules.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {schedules.map((schedule, idx) => (
                <span
                  key={idx}
                  className="rounded-lg bg-[#2a2a2a] px-3 py-1.5 text-sm text-zinc-300"
                >
                  {DAY_NAMES[schedule.day] || schedule.day} {schedule.hour}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sin horarios asignados</p>
          )}
        </div>

        {routine.routine && (
          <div className="rounded-2xl bg-[#201f1f] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Rutina
            </h2>

            <p className="mb-4 text-lg font-semibold text-white">
              {routine.routine.routine_name}
            </p>

            <div className="space-y-3">
              {routine.routine.exercises?.map((exercise) => (
                <div key={exercise.id} className="rounded-xl bg-[#2a2a2a] p-4">
                  <h3 className="font-semibold text-white">{exercise.name}</h3>

                  <p className="mt-2 text-zinc-400">
                    {exercise.sets} series
                    {exercise.reps ? ` • ${exercise.reps} reps` : ""}
                  </p>

                  {exercise.weight && (
                    <p className="mt-1 text-blue-300">
                      Peso: {exercise.weight} kg
                    </p>
                  )}

                  {exercise.notes && (
                    <p className="mt-1 text-zinc-500">{exercise.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PublicRoutine;
