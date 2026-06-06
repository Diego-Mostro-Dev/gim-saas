import { useState } from "react";

function ExerciseForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      await onSubmit(formData);

      setFormData({
        name: "",
        description: "",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-white/5 bg-[#201f1f] p-4"
    >
      <h2 className="text-lg font-semibold text-white">Nuevo ejercicio</h2>

      <input
        type="text"
        placeholder="Nombre"
        value={formData.name}
        onChange={(e) =>
          setFormData({
            ...formData,
            name: e.target.value,
          })
        }
        className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
        required
      />

      <textarea
        placeholder="Descripción"
        value={formData.description}
        onChange={(e) =>
          setFormData({
            ...formData,
            description: e.target.value,
          })
        }
        rows={3}
        className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white"
      >
        {isSubmitting ? "Guardando..." : "Guardar ejercicio"}
      </button>
    </form>
  );
}

export default ExerciseForm;
