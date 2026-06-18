import { useState } from "react";
import { Calendar, RefreshCw, XCircle } from "lucide-react";

import { useActiveRoutines } from "../../hooks/useActiveRoutines";
import { useMemberRoutine } from "../../hooks/useMemberRoutine";
import { useRoutineTemplates } from "../../hooks/useRoutineTemplates";

import {
  bulkAssignRoutine,
  deactivateAssignment,
} from "../../services/routines.service";

import MemberAvatar from "../common/MemberAvatar";
import MemberRoutineModal from "./MemberRoutineModal";

function ActiveRoutines() {
  const { activeRoutines, loading, error, reload } = useActiveRoutines();
  const { loadRoutine } = useMemberRoutine();
  const { templates } = useRoutineTemplates();

  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingRoutine, setLoadingRoutine] = useState(false);
  const [changeRoutineId, setChangeRoutineId] = useState(null);
  const [newTemplateId, setNewTemplateId] = useState("");

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

  async function handleDeactivate(assignment) {
    const confirmed = window.confirm(
      `¿Desactivar la rutina de ${assignment.member_name}?`,
    );
    if (!confirmed) return;

    try {
      await deactivateAssignment(assignment.id);
      reload();
    } catch (error) {
      console.error(error);
      alert("No se pudo desactivar la rutina.");
    }
  }

  async function handleChangeRoutine(memberId) {
    if (!newTemplateId || changeRoutineId !== memberId) return;

    try {
      await bulkAssignRoutine({
        routine_template: Number(newTemplateId),
        member_ids: [memberId],
      });
      setChangeRoutineId(null);
      setNewTemplateId("");
      reload();
    } catch (error) {
      console.error(error);
      alert("No se pudo cambiar la rutina.");
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
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
      <div className="rounded-xl bg-danger-bg p-4 text-danger-text dark:bg-danger/15 dark:text-danger">
        {error}
      </div>
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
            key={routine.id}
            className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <MemberAvatar
                photo={routine.member_photo}
                firstName={routine.member_name?.split(" ")[0]}
                lastName={routine.member_name?.split(" ").slice(1).join(" ")}
                size="sm"
              />

              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-text-primary">
                  {routine.member_name}
                </h3>

                <p className="mt-0.5 text-sm font-medium text-info-text dark:text-info">
                  {routine.routine_name}
                </p>

                <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                  <Calendar size={12} />
                  Asignado el {formatDate(routine.assigned_at)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => handleViewRoutine(routine.member_id)}
                disabled={loadingRoutine}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
              >
                {loadingRoutine ? "Cargando..." : "👁 Ver rutina"}
              </button>

              {changeRoutineId === routine.member_id ? (
                <div className="flex w-full flex-wrap items-center gap-2">
                  <select
                    value={newTemplateId}
                    onChange={(e) => setNewTemplateId(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="">Seleccionar rutina</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleChangeRoutine(routine.member_id)}
                    disabled={!newTemplateId}
                    className="rounded-lg bg-success px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Confirmar
                  </button>

                  <button
                    onClick={() => {
                      setChangeRoutineId(null);
                      setNewTemplateId("");
                    }}
                    className="rounded-lg bg-surface-input px-3 py-2 text-sm text-text-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setChangeRoutineId(routine.member_id)}
                  className="flex items-center gap-1.5 rounded-lg bg-info-bg px-4 py-2 text-sm font-medium text-info-text transition hover:bg-info/20 dark:bg-info/15 dark:text-info"
                >
                  <RefreshCw size={14} />
                  Cambiar rutina
                </button>
              )}

              <button
                onClick={() => handleDeactivate(routine)}
                className="flex items-center gap-1.5 rounded-lg bg-danger-bg px-4 py-2 text-sm font-medium text-danger-text transition hover:bg-danger/20 dark:bg-danger/15 dark:text-danger"
              >
                <XCircle size={14} />
                Desactivar
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
