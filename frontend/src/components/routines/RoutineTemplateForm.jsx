import { useState } from "react";

function RoutineTemplateForm({ onSubmit }) {
  const [name, setName] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim()) return;

    await onSubmit({
      name,
    });

    setName("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-white/5 bg-[#1a1a1a] p-4"
    >
      <h3 className="text-white font-medium">Nueva rutina</h3>

      <input
        type="text"
        placeholder="Ej: Push A"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
      />

      <button
        type="submit"
        className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white"
      >
        Guardar rutina
      </button>
    </form>
  );
}

export default RoutineTemplateForm;
