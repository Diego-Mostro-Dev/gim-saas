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

function formatDate(date) {
  return new Date(date).toLocaleDateString("es-AR");
}

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

  const { member, gym, subscription, schedules, attendance_history } = routine;

  return (
    <div className="min-h-screen bg-[#161616] p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* HEADER */}
        <div className="rounded-2xl bg-[#201f1f] p-6">
          <div className="flex items-center gap-4">
            {gym.logo_url ? (
              <img
                src={gym.logo_url}
                alt={gym.name}
                className="h-16 w-16 rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-500 text-2xl font-bold text-white">
                {gym.name?.charAt(0)?.toUpperCase()}
              </div>
            )}

            <div>
              <h1 className="text-2xl font-bold text-white">
                {member.first_name} {member.last_name}
              </h1>

              <p className="text-zinc-400">Socio de {gym.name}</p>
            </div>
          </div>
        </div>

        {/* SUSCRIPCIÓN */}
        <div className="rounded-2xl bg-[#201f1f] p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Suscripción
          </h2>

          {subscription ? (
            <>
              <div className="mb-4">
                {subscription.paid ? (
                  <span className="rounded-xl bg-green-500/15 px-3 py-1 text-sm font-semibold text-green-400">
                    ✓ Cuota al día
                  </span>
                ) : (
                  <span className="rounded-xl bg-yellow-500/15 px-3 py-1 text-sm font-semibold text-yellow-300">
                    ⚠ Pendiente de pago
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Plan</span>

                  <span className="text-white">{subscription.plan}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Inicio</span>

                  <span className="text-white">
                    {formatDate(subscription.start_date)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Vencimiento</span>

                  <span className="text-white">
                    {formatDate(subscription.end_date)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Sin suscripción activa</p>
          )}
        </div>

        {/* HORARIOS */}
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

        {/* ASISTENCIAS */}
        <div className="rounded-2xl bg-[#201f1f] p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Asistencias recientes
          </h2>

          <p className="mb-4 text-sm text-zinc-400">
            Total registradas: {attendance_history?.length || 0}
          </p>

          {attendance_history?.length > 0 ? (
            <div className="space-y-2">
              {attendance_history.map((attendance, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl bg-[#2a2a2a] px-4 py-3"
                >
                  <span className="font-medium text-green-400">
                    ✓ Asistencia
                  </span>

                  <span className="text-zinc-300">
                    {formatDate(attendance.date)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              Todavía no hay asistencias registradas.
            </p>
          )}
        </div>

        {/* RUTINA */}
        {routine.routine && (
          <div className="rounded-2xl bg-[#201f1f] p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              💪 Rutina actual
            </h2>

            <p className="text-xl font-bold text-white">
              {routine.routine.routine_name}
            </p>

            <p className="mb-4 text-sm text-zinc-400">
              {routine.routine.exercises?.length || 0} ejercicios
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
                      Peso: {exercise.weight}
                    </p>
                  )}

                  {exercise.notes && (
                    <p className="mt-2 text-zinc-500">{exercise.notes}</p>
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
