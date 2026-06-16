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
      className="space-y-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
    >
      <h3 className="text-text-primary font-medium">Nueva rutina</h3>

      <input
        type="text"
        placeholder="Ej: Push A"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary outline-none"
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
