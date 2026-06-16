import { useState } from "react";

function TemplateForm({ onSubmit }) {
  const [name, setName] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim()) return;

    try {
      setLoading(true);

      await onSubmit({
        name,
      });

      setName("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-text-primary">Nueva rutina</h2>

      <input
        type="text"
        value={name}
        placeholder="Nombre"
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white"
      >
        {loading ? "Guardando..." : "Guardar rutina"}
      </button>
    </form>
  );
}

export default TemplateForm;
