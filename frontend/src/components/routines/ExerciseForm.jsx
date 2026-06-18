import { useState, useEffect } from "react";

const CATEGORIES = [
  { value: "", label: "Sin categoría" },
  { value: "pecho", label: "Pecho" },
  { value: "espalda", label: "Espalda" },
  { value: "piernas", label: "Piernas" },
  { value: "hombros", label: "Hombros" },
  { value: "biceps", label: "Bíceps" },
  { value: "triceps", label: "Tríceps" },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
  { value: "movilidad", label: "Movilidad" },
];

function ExerciseForm({ onSubmit, editingExercise, onCancelEdit }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingExercise) {
      setFormData({
        name: editingExercise.name || "",
        description: editingExercise.description || "",
        category: editingExercise.category || "",
      });
    } else {
      setFormData({ name: "", description: "", category: "" });
    }
  }, [editingExercise]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      if (!editingExercise) {
        setFormData({ name: "", description: "", category: "" });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-text-primary">
        {editingExercise ? "Editar ejercicio" : "Nuevo ejercicio"}
      </h2>

      <input
        type="text"
        placeholder="Nombre"
        value={formData.name}
        onChange={(e) =>
          setFormData({ ...formData, name: e.target.value })
        }
        className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      />

      <select
        value={formData.category}
        onChange={(e) =>
          setFormData({ ...formData, category: e.target.value })
        }
        className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary outline-none"
      >
        {CATEGORIES.map((cat) => (
          <option key={cat.value} value={cat.value}>
            {cat.label}
          </option>
        ))}
      </select>

      <textarea
        placeholder="Descripción"
        value={formData.description}
        onChange={(e) =>
          setFormData({ ...formData, description: e.target.value })
        }
        rows={3}
        className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary outline-none"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-xl bg-blue-500 py-3 font-medium text-white"
        >
          {isSubmitting
            ? "Guardando..."
            : editingExercise
              ? "Guardar cambios"
              : "Guardar ejercicio"}
        </button>

        {editingExercise && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-xl bg-surface-input px-4 py-3 text-text-secondary"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

export default ExerciseForm;
