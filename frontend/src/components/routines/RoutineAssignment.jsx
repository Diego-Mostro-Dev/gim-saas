import { useState, useMemo } from "react";
import { Search, Filter, X } from "lucide-react";
import toast from "react-hot-toast";

import { useMembers } from "../../hooks/useMembers";
import { useRoutineTemplates } from "../../hooks/useRoutineTemplates";
import { useActiveRoutines } from "../../hooks/useActiveRoutines";

import { bulkAssignRoutine } from "../../services/routines.service";

import MemberAvatar from "../common/MemberAvatar";

function RoutineAssignment() {
  const { members, loading: membersLoading } = useMembers();
  const { templates, loading: templatesLoading } = useRoutineTemplates();
  const { activeRoutines, loading: activeLoading } = useActiveRoutines();

  const [selectedMembers, setSelectedMembers] = useState([]);
  const [routineTemplate, setRoutineTemplate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const activeByMember = useMemo(() => {
    const map = {};
    activeRoutines.forEach((r) => {
      map[r.member_id] = r;
    });
    return map;
  }, [activeRoutines]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const nameMatch =
        !search ||
        `${member.first_name} ${member.last_name}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const hasRoutine = !!activeByMember[member.id];

      const filterMatch =
        filter === "all" ||
        (filter === "assigned" && hasRoutine) ||
        (filter === "unassigned" && !hasRoutine);

      return nameMatch && filterMatch;
    });
  }, [members, search, filter, activeByMember]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!routineTemplate || selectedMembers.length === 0) return;

    try {
      setIsSubmitting(true);

      const response = await bulkAssignRoutine({
        routine_template: Number(routineTemplate),
        member_ids: selectedMembers,
      });

      toast.success(
        `Rutina "${response.routine}" asignada a ${response.assigned_members} miembros.`,
      );

      setSelectedMembers([]);
    } catch (error) {
      toast.error("No se pudo asignar la rutina.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleMember(memberId) {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  }

  function selectAllFiltered() {
    setSelectedMembers(filteredMembers.map((m) => m.id));
  }

  function deselectAll() {
    setSelectedMembers([]);
  }

  const loading = membersLoading || templatesLoading || activeLoading;

  if (loading) {
    return <div className="text-text-secondary">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm text-text-secondary">Rutina</label>

          <select
            value={routineTemplate}
            onChange={(e) => setRoutineTemplate(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary"
          >
            <option value="">Seleccionar rutina</option>

            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-sm text-text-secondary">Miembros</label>

            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="rounded-lg bg-surface-input px-3 py-1.5 text-text-secondary hover:text-text-primary"
              >
                Seleccionar todos
              </button>

              <button
                type="button"
                onClick={deselectAll}
                className="rounded-lg bg-surface-input px-3 py-1.5 text-text-secondary hover:text-text-primary"
              >
                Deseleccionar
              </button>
            </div>
          </div>

          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-input py-2.5 pl-9 pr-4 text-sm text-text-primary"
              />
            </div>

            <div className="flex gap-1">
              {[
                { value: "all", label: "Todos" },
                { value: "assigned", label: "Con rutina" },
                { value: "unassigned", label: "Sin rutina" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                    filter === opt.value
                      ? "bg-info text-white"
                      : "bg-surface-input text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredMembers.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-secondary">
                No se encontraron miembros.
              </div>
            )}

            {filteredMembers.map((member) => {
              const active = activeByMember[member.id];

              return (
                <label
                  key={member.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-elevated p-3 shadow-sm transition hover:border-info/30"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(member.id)}
                    onChange={() => toggleMember(member.id)}
                    className="shrink-0"
                  />

                  <MemberAvatar
                    photo={member.photo}
                    firstName={member.first_name}
                    lastName={member.last_name}
                    size="sm"
                  />

                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text-primary">
                      {member.first_name} {member.last_name}
                    </span>

                    {active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success dark:text-success">
                        ✅ {active.routine_name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                        ⚪ Sin rutina
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

      </form>

      {selectedMembers.length > 0 && (
        <>
          <div className="h-20" />
          <div className="fixed bottom-20 left-0 right-0 z-40 border-t border-border bg-surface-elevated px-4 py-3 shadow-lg shadow-black/5">
            <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
              <span className="text-sm font-medium text-text-primary">
                {selectedMembers.length} miembro{selectedMembers.length !== 1 ? "s" : ""} seleccionado{selectedMembers.length !== 1 ? "s" : ""}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={deselectAll}
                  className="rounded-lg p-2 text-text-secondary transition hover:bg-surface-input hover:text-text-primary"
                  aria-label="Deseleccionar"
                >
                  <X size={18} />
                </button>

                <button
                  onClick={() => {
                    const form = document.querySelector("form");
                    if (form) form.requestSubmit();
                  }}
                  disabled={isSubmitting || !routineTemplate}
                  className="rounded-xl bg-blue-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-50"
                >
                  {isSubmitting ? "Asignando..." : "Asignar rutina"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default RoutineAssignment;
