function PlanForm({
  formData,
  setFormData,
  onSubmit,
  isSubmitting,
  editingPlan,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-white/5 bg-[#201f1f] p-4"
    >
      <h2 className="text-lg font-semibold text-white">
        {editingPlan ? "Editar plan" : "Nuevo plan"}
      </h2>

      <input
        type="text"
        placeholder="Nombre del plan"
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

      <input
        type="number"
        placeholder="Precio"
        value={formData.price}
        onChange={(e) =>
          setFormData({
            ...formData,
            price: e.target.value,
          })
        }
        className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
        required
      />

      <input
        type="number"
        placeholder="Duración en días"
        value={formData.duration_days}
        onChange={(e) =>
          setFormData({
            ...formData,
            duration_days: e.target.value,
          })
        }
        className="w-full rounded-xl bg-[#2a2a2a] px-4 py-3 text-white outline-none"
        required
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white"
      >
        {isSubmitting
          ? editingPlan
            ? "Guardando..."
            : "Creando..."
          : editingPlan
            ? "Guardar Cambios"
            : "Crear Plan"}
      </button>
    </form>
  );
}

export default PlanForm;
