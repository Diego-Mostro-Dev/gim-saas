import { useState } from "react";

import { useActiveRoutines } from "../../hooks/useActiveRoutines";
import { useMemberRoutine } from "../../hooks/useMemberRoutine";

import MemberRoutineModal from "./MemberRoutineModal";

function ActiveRoutines() {
  const { activeRoutines, loading, error } = useActiveRoutines();

  const { loadRoutine } = useMemberRoutine();

  const [selectedRoutine, setSelectedRoutine] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);

  const [loadingRoutine, setLoadingRoutine] = useState(false);

  async function handleViewRoutine(memberId) {
    try {
      setLoadingRoutine(true);

      const data = await loadRoutine(memberId);

      setSelectedRoutine(data);

      setModalOpen(true);
    } catch (error) {
      console.error(error);

      alert("No se pudo cargar la rutina");
    } finally {
      setLoadingRoutine(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border p-6 text-center text-text-secondary">
        Cargando rutinas activas...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-danger-bg dark:bg-danger/15 p-4 text-danger-text dark:text-danger">{error}</div>
    );
  }

  if (activeRoutines.length === 0) {
    return (
      <div className="rounded-xl border border-border p-6 text-center text-text-secondary">
        No hay rutinas activas.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {activeRoutines.map((routine) => (
          <div
            key={`${routine.member_id}-${routine.routine_id}`}
            className="rounded-lg border border-border bg-surface-input p-4 shadow-sm"
          >
            <h3 className="font-semibold text-text-primary">{routine.member_name}</h3>

            <p className="mt-1 text-sm text-info-text dark:text-info">{routine.routine_name}</p>

            <div className="mt-4">
              <button
                onClick={() => handleViewRoutine(routine.member_id)}
                disabled={loadingRoutine}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {loadingRoutine ? "Cargando..." : "👁 Ver rutina"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <MemberRoutineModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedRoutine(null);
        }}
        routine={selectedRoutine}
      />
    </>
  );
}

export default ActiveRoutines;
