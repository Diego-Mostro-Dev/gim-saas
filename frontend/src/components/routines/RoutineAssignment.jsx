import { useState } from "react";

import { useMembers } from "../../hooks/useMembers";
import { useRoutineTemplates } from "../../hooks/useRoutineTemplates";

import { bulkAssignRoutine } from "../../services/routines.service";

function RoutineAssignment() {
  const { members, loading: membersLoading } = useMembers();

  const { templates, loading: templatesLoading } = useRoutineTemplates();

  const [selectedMembers, setSelectedMembers] = useState([]);

  const [routineTemplate, setRoutineTemplate] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (!routineTemplate || selectedMembers.length === 0) {
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await bulkAssignRoutine({
        routine_template: Number(routineTemplate),
        member_ids: selectedMembers,
      });

      setSuccessMessage(
        `Rutina "${response.routine}" asignada a ${response.assigned_members} miembros.`,
      );

      setSelectedMembers([]);
    } catch (error) {
      console.error(error);

      alert("No se pudo asignar la rutina.");
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

  if (membersLoading || templatesLoading) {
    return <div className="text-zinc-400">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm text-zinc-400">Rutina</label>

          <select
            value={routineTemplate}
            onChange={(e) => setRoutineTemplate(e.target.value)}
            className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white"
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
          <label className="mb-2 block text-sm text-zinc-400">Miembros</label>

          <div className="space-y-2">
            {members.map((member) => (
              <label
                key={member.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3"
              >
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(member.id)}
                  onChange={() => toggleMember(member.id)}
                />

                <span className="text-white">
                  {member.first_name} {member.last_name}
                </span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white"
        >
          {isSubmitting ? "Asignando..." : "Asignar rutina"}
        </button>
      </form>

      {successMessage && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-green-300">
          {successMessage}
        </div>
      )}
    </div>
  );
}

export default RoutineAssignment;
