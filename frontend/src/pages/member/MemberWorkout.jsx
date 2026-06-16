import { useOutletContext } from "react-router-dom";

function MemberWorkout() {
  const { routine } = useOutletContext();

  if (!routine.routine) {
    return (
      <div className="rounded-xl bg-surface-elevated p-8 text-center shadow-sm">
        <p className="text-text-secondary">Sin rutina asignada</p>
      </div>
    );
  }

  const { routine_name, exercises } = routine.routine;
  const exerciseCount = exercises?.length || 0;

  return (
    <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Rutina
        </span>
        <span className="rounded-full bg-info-bg px-3 py-0.5 text-xs font-medium text-info-text dark:bg-info/15 dark:text-info">
          {exerciseCount} ejercicios
        </span>
      </div>

      <h2 className="mb-5 text-2xl font-bold text-text-primary">{routine_name}</h2>

      <div className="space-y-3">
        {exercises?.map((exercise, index) => (
          <div
            key={exercise.id}
            className="rounded-lg bg-surface-input border border-border p-4 transition active:bg-surface-elevated"
          >
            <div className="mb-2 flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info-bg text-sm font-bold text-info-text dark:bg-info/15 dark:text-info">
                {index + 1}
              </span>
              <h3 className="text-lg font-semibold text-text-primary">
                {exercise.name}
              </h3>
            </div>

            <div className="ml-11 space-y-1.5">
              <p className="text-base text-text-primary">
                <span className="font-medium text-text-primary">{exercise.sets}</span>{" "}
                series
                {exercise.reps ? (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-medium text-text-primary">
                      {exercise.reps}
                    </span>{" "}
                    reps
                  </>
                ) : null}
              </p>

              {exercise.weight && (
                <p className="text-sm font-medium text-info-text dark:text-info">
                  {exercise.weight}
                </p>
              )}

              {exercise.notes && (
                <p className="text-sm text-text-secondary italic">
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
