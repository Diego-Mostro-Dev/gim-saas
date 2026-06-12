import { useOutletContext } from "react-router-dom";

function MemberWorkout() {
  const { routine } = useOutletContext();

  if (!routine.routine) {
    return (
      <div className="rounded-2xl bg-[#201f1f] p-8 text-center">
        <p className="text-zinc-500">Sin rutina asignada</p>
      </div>
    );
  }

  const { routine_name, exercises } = routine.routine;
  const exerciseCount = exercises?.length || 0;

  return (
    <div className="rounded-2xl bg-[#201f1f] p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Rutina
        </span>
        <span className="rounded-full bg-blue-500/15 px-3 py-0.5 text-xs font-medium text-blue-400">
          {exerciseCount} ejercicios
        </span>
      </div>

      <h2 className="mb-5 text-2xl font-bold text-white">{routine_name}</h2>

      <div className="space-y-3">
        {exercises?.map((exercise, index) => (
          <div
            key={exercise.id}
            className="rounded-xl bg-[#2a2a2a] p-4 transition active:bg-[#333]"
          >
            <div className="mb-2 flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-sm font-bold text-blue-400">
                {index + 1}
              </span>
              <h3 className="text-lg font-semibold text-white">
                {exercise.name}
              </h3>
            </div>

            <div className="ml-11 space-y-1.5">
              <p className="text-base text-zinc-300">
                <span className="font-medium text-white">{exercise.sets}</span>{" "}
                series
                {exercise.reps ? (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-medium text-white">
                      {exercise.reps}
                    </span>{" "}
                    reps
                  </>
                ) : null}
              </p>

              {exercise.weight && (
                <p className="text-sm font-medium text-blue-400">
                  {exercise.weight}
                </p>
              )}

              {exercise.notes && (
                <p className="text-sm text-zinc-500 italic">
                  {exercise.notes}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MemberWorkout;
