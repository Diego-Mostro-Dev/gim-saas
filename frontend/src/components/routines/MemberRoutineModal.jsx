function MemberRoutineModal({ open, onClose, routine }) {
  if (!open || !routine) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-[#201f1f] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {routine.routine_name}
          </h2>

          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {routine.exercises?.map((exercise) => (
            <div
              key={exercise.id}
              className="rounded-xl border border-white/10 p-4"
            >
              <h3 className="font-medium text-white">{exercise.name}</h3>

              <p className="text-sm text-zinc-400">
                {exercise.sets} series • {exercise.reps}
              </p>

              {exercise.weight && (
                <p className="text-sm text-blue-300">Peso: {exercise.weight}</p>
              )}

              {exercise.notes && (
                <p className="mt-1 text-sm text-zinc-500">{exercise.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MemberRoutineModal;
