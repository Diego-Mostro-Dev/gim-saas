import { useState } from "react";

function TemplateDetails({
  template,
  exercises = [],
  allExercises = [],
  addRoutineExercise,
  removeRoutineExercise,
  editTemplate,
  removeTemplate,
  onTemplateDeleted,
}) {
  const [formData, setFormData] = useState({
    exercise: "",
    sets: 3,
    reps: "",
    weight: "",
    notes: "",
  });

  if (!template) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
        Selecciona una rutina para verla.
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.exercise) return;

    await addRoutineExercise({
      routine_template: template.id,
      exercise: Number(formData.exercise),
      order: exercises.length + 1,
      sets: Number(formData.sets),
      reps: formData.reps,
      weight: formData.weight,
      notes: formData.notes,
    });

    setFormData({
      exercise: "",
      sets: 3,
      reps: "",
      weight: "",
      notes: "",
    });
  }

  async function handleRename() {
    const newName = prompt("Nuevo nombre de la rutina", template.name);

    if (!newName?.trim()) return;

    await editTemplate(template.id, {
      name: newName,
    });

    window.location.reload();
  }

  async function handleDeleteTemplate() {
    const confirmed = window.confirm(`¿Eliminar la rutina "${template.name}"?`);

    if (!confirmed) return;

    await removeTemplate(template.id);

    if (onTemplateDeleted) {
      onTemplateDeleted();
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">{template.name}</h2>

            <p className="text-sm text-zinc-400">
              {exercises.length} ejercicios
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRename}
              className="rounded-lg bg-yellow-500 px-3 py-2 text-sm font-medium text-black"
            >
              Renombrar
            </button>

            <button
              onClick={handleDeleteTemplate}
              className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white"
            >
              Eliminar rutina
            </button>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-xl border border-white/10 bg-[#1a1a1a] p-4"
      >
        <h3 className="font-semibold text-white">Agregar ejercicio</h3>

        <select
          value={formData.exercise}
          onChange={(e) =>
            setFormData({
              ...formData,
              exercise: e.target.value,
            })
          }
          className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white"
        >
          <option value="">Seleccionar ejercicio</option>

          {allExercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white"
        >
          Agregar
        </button>
      </form>

      <div className="space-y-3">
        {exercises.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-zinc-500">
            Esta rutina todavía no tiene ejercicios.
          </div>
        ) : (
          exercises.map((exercise) => (
            <div
              key={exercise.id}
              className="rounded-xl border border-white/10 bg-[#1a1a1a] p-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h4 className="font-medium text-white">
                    {exercise.exercise_name}
                  </h4>

                  <p className="text-sm text-zinc-500">
                    {exercise.sets} series
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeRoutineExercise(exercise.id)}
                  className="rounded-lg bg-red-500 px-3 py-2 text-sm text-white"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TemplateDetails;
