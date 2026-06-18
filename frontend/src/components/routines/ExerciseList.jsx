import { Dumbbell, Pencil, Trash2 } from "lucide-react";

const CATEGORY_LABELS = {
  pecho: "Pecho",
  espalda: "Espalda",
  piernas: "Piernas",
  hombros: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  core: "Core",
  cardio: "Cardio",
  movilidad: "Movilidad",
};

function ExerciseList({ exercises, onEdit, onDelete }) {
  if (!exercises.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-text-secondary">
        No hay ejercicios cargados
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {exercises.map((exercise) => (
        <div
          key={exercise.id}
          className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Dumbbell size={18} className="shrink-0 text-blue-400" />

              <div>
                <h3 className="font-medium text-text-primary">{exercise.name}</h3>

                {exercise.category && (
                  <span className="mt-0.5 inline-block rounded-full bg-info-bg px-2.5 py-0.5 text-xs font-medium text-info-text dark:bg-info/15 dark:text-info">
                    {CATEGORY_LABELS[exercise.category] || exercise.category}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => onEdit(exercise)}
                className="rounded-lg p-2 text-text-secondary transition hover:bg-surface-input hover:text-text-primary"
                title="Editar"
              >
                <Pencil size={16} />
              </button>

              <button
                onClick={() => onDelete(exercise)}
                className="rounded-lg p-2 text-text-secondary transition hover:bg-danger/15 hover:text-danger"
                title="Eliminar"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {exercise.description && (
            <p className="mt-2 text-sm text-text-secondary">
              {exercise.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default ExerciseList;
