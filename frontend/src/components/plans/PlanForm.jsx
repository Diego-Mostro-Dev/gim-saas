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
      className="space-y-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-text-primary">
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
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      />

      <textarea
        placeholder="Descripción (opcional)"
        value={formData.description}
        onChange={(e) =>
          setFormData({
            ...formData,
            description: e.target.value,
          })
        }
        rows={3}
        className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary outline-none resize-none"
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
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
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
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      />

      <input
        type="number"
        min="1"
        placeholder="Visitas semanales (dejar vacío para acceso ilimitado)"
        value={formData.weekly_visits}
        onChange={(e) =>
          setFormData({
            ...formData,
            weekly_visits: e.target.value === "" ? "" : Number(e.target.value),
          })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
      />

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.active}
          onChange={(e) =>
            setFormData({
              ...formData,
              active: e.target.checked,
            })
          }
          className="h-5 w-5 rounded border border-border bg-surface-input text-blue-500"
        />
        <span className="text-sm text-text-primary">Plan activo</span>
      </label>

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
            ? "Guardar cambios"
            : "Crear plan"}
      </button>
    </form>
  );
}

export default PlanForm;
