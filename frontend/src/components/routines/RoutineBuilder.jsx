import { useState } from "react";

function RoutineBuilder({
  templates,
  exercises,
  routineExercises,
  addRoutineExercise,
}) {
  const [formData, setFormData] = useState({
    routine_template: "",
    exercise: "",
    order: 1,
    sets: 3,
    reps: "",
    weight: "",
    notes: "",
  });

  const filteredExercises = routineExercises.filter(
    (item) =>
      String(item.routine_template) === String(formData.routine_template),
  );

  async function handleSubmit(e) {
    e.preventDefault();

    await addRoutineExercise(formData);

    setFormData({
      ...formData,
      exercise: "",
      reps: "",
      weight: "",
      notes: "",
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-info/20 bg-info-bg/50 p-4 dark:bg-info/15">
        <h3 className="mb-2 font-semibold text-info-text dark:text-info">
          Cómo completar una rutina
        </h3>

        <div className="text-sm text-text-primary">
          <p>🏋️ Press banca</p>
          <p>4 series</p>
          <p>8-10 repeticiones</p>
          <p>60kg</p>
          <p>Controlar la bajada y evitar rebotes</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm text-text-secondary">
            Plantilla de rutina
          </label>

          <select
            value={formData.routine_template}
            onChange={(e) =>
              setFormData({
                ...formData,
                routine_template: e.target.value,
              })
            }
            className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary"
          >
            <option value="">Seleccionar plantilla</option>

            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-text-secondary">Ejercicio</label>

          <select
            value={formData.exercise}
            onChange={(e) =>
              setFormData({
                ...formData,
                exercise: e.target.value,
              })
            }
            className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary"
          >
            <option value="">Seleccionar ejercicio</option>

            {exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-text-secondary">
            Posición en la rutina
          </label>

          <input
            type="number"
            min="1"
            value={formData.order}
            onChange={(e) =>
              setFormData({
                ...formData,
                order: e.target.value,
              })
            }
            className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary"
          />

          <p className="mt-1 text-xs text-text-secondary">
            1 = primer ejercicio, 2 = segundo, etc.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-text-secondary">Series</label>

          <input
            type="number"
            min="1"
            placeholder="Ej: 4"
            value={formData.sets}
            onChange={(e) =>
              setFormData({
                ...formData,
                sets: e.target.value,
              })
            }
            className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-text-secondary">
            Repeticiones
          </label>

          <input
            placeholder="Ej: 8-10"
            value={formData.reps}
            onChange={(e) =>
              setFormData({
                ...formData,
                reps: e.target.value,
              })
            }
            className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-text-secondary">
            Peso objetivo
          </label>

          <input
            placeholder="Ej: 60kg, Peso corporal, RPE 8"
            value={formData.weight}
            onChange={(e) =>
              setFormData({
                ...formData,
                weight: e.target.value,
              })
            }
            className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-text-secondary">
            Indicaciones para el alumno
          </label>

          <textarea
            placeholder="Ej: Controlar la bajada y evitar rebotes"
            value={formData.notes}
            onChange={(e) =>
              setFormData({
                ...formData,
                notes: e.target.value,
              })
            }
            className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white"
        >
          Agregar ejercicio a la rutina
        </button>
      </form>

      {formData.routine_template && (
        <div className="space-y-3">
          <h3 className="font-semibold text-text-primary">
            Ejercicios de la plantilla
          </h3>

          {filteredExercises.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
            >
              <p className="font-medium text-text-primary">
                #{item.order} • {item.exercise_name}
              </p>

              <p className="text-sm text-text-secondary">
                {item.sets} series • {item.reps}
              </p>

              {item.weight && (
                <p className="mt-1 text-sm text-info-text dark:text-info">🏋️ {item.weight}</p>
              )}

              {item.notes && (
                <p className="mt-1 text-sm text-text-secondary">📝 {item.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RoutineBuilder;
