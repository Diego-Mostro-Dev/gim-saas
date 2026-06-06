import { useActiveRoutines } from "../../hooks/useActiveRoutines";

function ActiveRoutines() {
  const { activeRoutines, loading, error } = useActiveRoutines();

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 p-6 text-center text-zinc-400">
        Cargando rutinas activas...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 p-4 text-red-300">{error}</div>
    );
  }

  if (activeRoutines.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 p-6 text-center text-zinc-400">
        No hay rutinas activas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeRoutines.map((routine) => (
        <div
          key={`${routine.member_id}-${routine.routine_id}`}
          className="rounded-xl border border-white/10 bg-[#2a2a2a] p-4"
        >
          <h3 className="font-semibold text-white">{routine.member_name}</h3>

          <p className="mt-1 text-sm text-blue-300">{routine.routine_name}</p>
        </div>
      ))}
    </div>
  );
}

export default ActiveRoutines;
