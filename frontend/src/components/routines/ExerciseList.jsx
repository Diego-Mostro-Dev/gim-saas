import { Dumbbell } from "lucide-react";

function ExerciseList({ exercises }) {
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
          <div className="flex items-center gap-3">
            <Dumbbell size={18} className="text-blue-400" />

            <h3 className="font-medium text-text-primary">{exercise.name}</h3>
          </div>

          {exercise.description && (
            <p className="mt-2 text-sm text-text-secondary">{exercise.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default ExerciseList;
