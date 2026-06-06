import { Dumbbell } from "lucide-react";

function ExerciseList({ exercises }) {
  if (!exercises.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
        No hay ejercicios cargados
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {exercises.map((exercise) => (
        <div
          key={exercise.id}
          className="rounded-2xl border border-white/5 bg-[#201f1f] p-4"
        >
          <div className="flex items-center gap-3">
            <Dumbbell size={18} className="text-blue-400" />

            <h3 className="font-medium text-white">{exercise.name}</h3>
          </div>

          {exercise.description && (
            <p className="mt-2 text-sm text-zinc-400">{exercise.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default ExerciseList;
