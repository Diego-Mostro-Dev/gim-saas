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
      className="space-y-3 rounded-2xl border border-white/5 bg-[#201f1f] p-4"
    >
      <h2 className="text-lg font-semibold text-white">Nueva rutina</h2>

      <input
        type="text"
        value={name}
        placeholder="Nombre"
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
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
