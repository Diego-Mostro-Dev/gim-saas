import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Play, CheckCircle2, Clock, ArrowRight } from "lucide-react";

import {
  getWorkoutProgress,
  toggleWorkoutSet,
} from "../../services/routines.service";

function formatRest(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? m + ":" + String(s).padStart(2, "0") : m + ":00";
}

function RestTimer({ seconds, onFinish, autoStart }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(autoStart || false);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      setRunning(false);
      if (onFinish) onFinish();
      return;
    }
    const id = setTimeout(function () {
      setRemaining(function (r) { return r - 1; });
    }, 1000);
    return function () { clearTimeout(id); };
  }, [running, remaining, onFinish]);

  function handleStart() {
    setRemaining(seconds);
    setRunning(true);
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      {running ? (
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-info-text dark:text-info" />
          <span
            className={
              "font-mono text-sm font-medium " + (
                remaining <= 5
                  ? "text-danger"
                  : "text-info-text dark:text-info"
              )
            }
          >
            {formatRest(remaining)}
          </span>
        </div>
      ) : (
        <button
          onClick={handleStart}
          className="flex items-center gap-1 rounded-lg bg-surface-input px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-info/20 hover:text-info-text"
        >
          <Play size={12} />
          {"Iniciar descanso (" + formatRest(seconds) + ")"}
        </button>
      )}
    </div>
  );
}

function MemberWorkout() {
  const { routine, token } = useOutletContext();

  const [progress, setProgress] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [expandedCompleted, setExpandedCompleted] = useState({});
  const [processing, setProcessing] = useState({});

  useEffect(function () {
    if (!token) return;
    getWorkoutProgress(token)
      .then(function (sets) {
        var map = {};
        sets.forEach(function (s) {
          if (!map[s.routine_exercise]) {
            map[s.routine_exercise] = {};
          }
          map[s.routine_exercise][s.set_number] = s.completed;
        });
        setProgress(map);
      })
      .catch(function () {})
      .finally(function () { setLoaded(true); });
  }, [token]);

  const exercises = routine.routine?.exercises || [];

  function getCompletedSets(exerciseId) {
    var ex = exercises.find(function (e) { return e.id === exerciseId; });
    if (!ex) return 0;
    var count = 0;
    for (var i = 1; i <= ex.sets; i++) {
      if (progress[exerciseId]?.[i]) count++;
    }
    return count;
  }

  function isExerciseComplete(exerciseId) {
    var ex = exercises.find(function (e) { return e.id === exerciseId; });
    if (!ex) return false;
    return getCompletedSets(exerciseId) >= ex.sets;
  }

  var totalSets = 0;
  for (var e = 0; e < exercises.length; e++) {
    totalSets += exercises[e].sets;
  }

  var completedSets = 0;
  for (var f = 0; f < exercises.length; f++) {
    completedSets += getCompletedSets(exercises[f].id);
  }

  var progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  var allComplete = completedSets >= totalSets && totalSets > 0;

  function toggleCompletedExercise(exerciseId) {
    setExpandedCompleted(function (prev) {
      var next = {};
      for (var key in prev) {
        if (Object.prototype.hasOwnProperty.call(prev, key)) {
          next[key] = prev[key];
        }
      }
      if (next[exerciseId]) {
        delete next[exerciseId];
      } else {
        next[exerciseId] = true;
      }
      return next;
    });
  }

  async function handleToggleSet(exerciseId, setNum) {
    const key = exerciseId + "-" + setNum;
    if (processing[key]) return;

    setProcessing(function (prev) {
      return { ...prev, [key]: true };
    });

    var current = progress[exerciseId]?.[setNum] || false;
    var newCompleted = !current;

    setProgress(function (prev) {
      return {
        ...prev,
        [exerciseId]: {
          ...(prev[exerciseId] || {}),
          [setNum]: newCompleted,
        },
      };
    });

    try {
      await toggleWorkoutSet(token, {
        routine_exercise: exerciseId,
        set_number: setNum,
        completed: newCompleted,
      });
    } catch {
      setProgress(function (prev) {
        return {
          ...prev,
          [exerciseId]: {
            ...(prev[exerciseId] || {}),
            [setNum]: current,
          },
        };
      });
    } finally {
      setProcessing(function (prev) {
        var next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  if (!routine.routine) {
    return (
      <div className="rounded-xl bg-surface-elevated p-8 text-center shadow-sm">
        <p className="text-text-secondary">Sin rutina asignada</p>
      </div>
    );
  }

  var routineName = routine.routine.routine_name;

  function renderExercise(exercise, index) {
    var isStrength = exercise.exercise_type === "strength";
    var isBodyweight = exercise.exercise_type === "bodyweight";
    var isCardio = exercise.exercise_type === "cardio";
    var restMode = exercise.rest_mode || "between_sets";
    var complete = isExerciseComplete(exercise.id);
    var completedCount = getCompletedSets(exercise.id);
    var nextSet = completedCount + 1;
    var hasNextRest = Number(exercise.next_exercise_rest_seconds) > 0;
    var collapsed = complete && !expandedCompleted[exercise.id];

    function formatRestSeconds(secs) {
      if (secs >= 60) {
        var m = Math.floor(secs / 60);
        var s = secs % 60;
        return m + "min " + (s > 0 ? s + "s" : "");
      }
      return String(secs) + "s";
    }

    if (collapsed) {
      return (
        <div
          key={exercise.id}
          className="rounded-lg border border-success/30 bg-success-bg/50 dark:bg-success/5 p-4 transition cursor-pointer hover:bg-success-bg/80"
          onClick={function () { toggleCompletedExercise(exercise.id); }}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-success shrink-0" fill="currentColor" />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-text-primary">{exercise.name}</h3>
              <p className="mt-0.5 text-sm text-success">{'\u2713'} Ejercicio completado</p>
              <p className="text-xs text-text-secondary">{completedCount}/{exercise.sets} series completadas</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={exercise.id}
        className={
          "rounded-lg border p-4 transition " + (
            complete
              ? "border-success/30 bg-success-bg/50 dark:bg-success/5"
              : "border-border bg-surface-input"
          )
        }
      >
        <div className="flex items-start gap-3">
          {!complete && isCardio ? (
            <button
              onClick={function () { handleToggleSet(exercise.id, 1); }}
              disabled={!!processing[exercise.id + "-1"]}
              className={
                "mt-0.5 shrink-0 rounded-md p-1 transition " + (
                  complete
                    ? "text-success"
                    : "text-text-secondary hover:text-success"
                )
              }
            >
              <CheckCircle2
                size={22}
                fill={complete ? "currentColor" : "none"}
              />
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            <div
              className={
                "mb-2 flex flex-wrap items-center gap-2 " + (
                  complete ? "cursor-pointer" : ""
                )
              }
              onClick={complete ? function () { toggleCompletedExercise(exercise.id); } : undefined}
              role={complete ? "button" : undefined}
              tabIndex={complete ? 0 : undefined}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-info-bg text-xs font-bold text-info-text dark:bg-info/15 dark:text-info">
                {index + 1}
              </span>
              <h3
                className={
                  "text-lg font-semibold " + (
                    complete
                      ? "text-text-secondary line-through"
                      : "text-text-primary"
                  )
                }
              >
                {exercise.name}
              </h3>

              {isBodyweight && (
                <span className="rounded-full bg-surface-input px-2 py-0.5 text-[10px] font-medium uppercase text-text-secondary">
                  Peso corporal
                </span>
              )}
              {isCardio && (
                <span className="rounded-full bg-surface-input px-2 py-0.5 text-[10px] font-medium uppercase text-text-secondary">
                  Cardio
                </span>
              )}
            </div>

            <div className="ml-0 space-y-1.5">
              {isCardio ? (
                <>
                  {exercise.reps && (
                    <p className="text-base text-text-primary">
                      <span className="font-medium">{exercise.reps}</span> minutos
                    </p>
                  )}
                  <p className="text-xs text-text-secondary">
                    {complete ? "Completado" : "Toca el checkbox al finalizar"}
                  </p>
                </>
              ) : (
                <>
                  {isStrength && (
                    <div className="text-sm text-text-primary">
                      <span className="font-medium">{exercise.sets}</span>
                      {" series"}
                      {exercise.reps
                        ? " \u00b7 " + exercise.reps + " reps"
                        : ""}
                      {exercise.weight
                        ? " \u00b7 " + exercise.weight + " kg"
                        : ""}
                    </div>
                  )}

                  {isBodyweight && (
                    <div className="text-sm text-text-primary">
                      <span className="font-medium">{exercise.sets}</span>
                      {" series"}
                      {exercise.reps
                        ? " \u00b7 " + exercise.reps + " reps"
                        : ""}
                    </div>
                  )}

                  {isBodyweight && (
                    <p className="text-xs font-medium text-info-text dark:text-info">
                      Peso corporal
                    </p>
                  )}

                  {!complete && exercise.notes && (
                    <p className="text-sm italic text-text-secondary">
                      {exercise.notes}
                    </p>
                  )}

                  {!complete && restMode !== "none" && exercise.rest_seconds && (
                    <p className="text-xs text-text-secondary">
                      {"Descanso: " + formatRestSeconds(exercise.rest_seconds) + (restMode === "after_exercise" ? " al finalizar ejercicio" : " entre series")}
                    </p>
                  )}

                  {!complete && restMode === "none" && (
                    <p className="text-xs text-text-secondary">Sin descanso</p>
                  )}

                  {/* Next exercise rest label */}
                  {hasNextRest && complete && (
                    <p className="text-xs text-text-secondary">
                      {"Descanso antes del pr\u00f3ximo: " + formatRestSeconds(exercise.next_exercise_rest_seconds)}
                    </p>
                  )}

                  {/* Current set indicator */}
                  <div className="mt-1 text-xs font-medium text-text-primary">
                    {complete ? (
                      <span className="text-success">{'\u2713'} Ejercicio completado</span>
                    ) : (
                      <span>{"Pr\u00f3xima serie: " + nextSet + " de " + exercise.sets}</span>
                    )}
                  </div>

                  {!complete && (
                    <div className="mt-2 space-y-1.5">
                      {function () {
                        var rows = [];
                        var lastDone = function () {
                          var last = 0;
                          for (var x = 1; x <= exercise.sets; x++) {
                            if (progress[exercise.id]?.[x]) last = x;
                          }
                          return last;
                        }();
                        for (let s = 1; s <= exercise.sets; s++) {
                          var done = progress[exercise.id]?.[s] || false;

                          rows.push(
                            <div key={s} className="flex items-center gap-2">
                              <button
                                onClick={function () { handleToggleSet(exercise.id, s); }}
                                disabled={!!processing[exercise.id + "-" + s]}
                                className={
                                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition " + (
                                    done
                                      ? "bg-success-bg text-success-text dark:bg-success/15 dark:text-success"
                                      : "bg-surface-input text-text-secondary hover:bg-surface-elevated"
                                  )
                                }
                              >
                                <CheckCircle2
                                  size={16}
                                  fill={done ? "currentColor" : "none"}
                                />
                                {"Serie " + s}
                              </button>

                              {restMode === "between_sets" && done && s < exercise.sets && lastDone === s && (
                                <RestTimer
                                  key={"rest-" + exercise.id + "-" + s}
                                  seconds={exercise.rest_seconds}
                                />
                              )}
                            </div>
                          );
                        }
                        return rows;
                      }()}
                    </div>
                  )}

                  {restMode === "after_exercise" && complete && exercise.rest_seconds && (
                    <div className="mt-3">
                      <RestTimer
                        key={"rest-after-" + exercise.id}
                        seconds={exercise.rest_seconds}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Rutina
        </span>
        {totalSets > 0 && (
          <span className="rounded-full bg-info-bg px-3 py-0.5 text-xs font-medium text-info-text dark:bg-info/15 dark:text-info">
            {completedSets + "/" + totalSets + " series"}
          </span>
        )}
      </div>

      <h2 className="mb-3 text-2xl font-bold text-text-primary">
        {routineName}
      </h2>

      {totalSets > 0 && (
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-text-primary">
              {allComplete ? (
                <span className="text-success">{'\u2705'} Rutina completada</span>
              ) : (
                completedSets + " / " + totalSets + " sets completados"
              )}
            </span>
            <span className="text-text-secondary">
              {Math.round(progressPct) + "%"}
            </span>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-surface-input">
            <div
              className={
                "h-full rounded-full transition-all duration-300 " + (
                  allComplete ? "bg-success" : "bg-info"
                )
              }
              style={{ width: progressPct + "%" }}
            />
          </div>
        </div>
      )}

      {allComplete && (
        <div className="mb-4 rounded-lg border border-success/30 bg-success-bg/50 dark:bg-success/5 p-4 text-center">
          <h3 className="text-lg font-bold text-success">{'\u2705'} Rutina completada</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Has completado todos los ejercicios de esta rutina.
          </p>
        </div>
      )}

      {!allComplete && (
        <div className="space-y-3">
          {function () {
            var cards = [];
            for (var i = 0; i < exercises.length; i++) {
              cards.push(renderExercise(exercises[i], i));

              // Rest between exercises
              var ex = exercises[i];
              var exComplete = isExerciseComplete(ex.id);
              var hasNextRest = Number(ex.next_exercise_rest_seconds) > 0;
              if (exComplete && hasNextRest && i < exercises.length - 1) {
                cards.push(
                  <div key={"next-rest-" + ex.id} className="rounded-lg border border-info/20 bg-info-bg/30 p-3 text-center">
                    <p className="text-xs font-medium text-text-secondary">
                      {"Descanso antes del pr\u00f3ximo ejercicio"}
                    </p>
                    <RestTimer
                      key={"between-rest-" + ex.id}
                      seconds={ex.next_exercise_rest_seconds}
                      autoStart={true}
                    />
                    <div className="mt-1 flex items-center justify-center gap-1 text-xs text-text-secondary">
                      <ArrowRight size={12} />
                      <span>{exercises[i + 1]?.name}</span>
                    </div>
                  </div>
                );
              }
            }
            return cards;
          }()}
        </div>
      )}
    </div>
  );
}

export default MemberWorkout;
