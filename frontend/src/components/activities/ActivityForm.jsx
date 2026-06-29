function ActivityForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSubmitting,
  editingActivity,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-text-primary">
        {editingActivity ? "Editar actividad" : "Nueva actividad"}
      </h2>

      <div>
        <label htmlFor="activity-name" className="mb-1 block text-sm font-medium text-text-primary">
          Nombre
        </label>

        <input
          id="activity-name"
          type="text"
          placeholder="Ej: Yoga, CrossFit, Zumba"
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring"
          required
        />
      </div>

      <div>
        <label htmlFor="activity-description" className="mb-1 block text-sm font-medium text-text-primary">
          Descripción
        </label>

        <textarea
          id="activity-description"
          placeholder="Descripción opcional de la actividad"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          rows={3}
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition resize-none focus:ring-2 focus:ring-focus-ring"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={formData.active}
          onChange={(e) =>
            setFormData({ ...formData, active: e.target.checked })
          }
          className="h-5 w-5 rounded border border-border bg-surface-input text-blue-500 transition focus:ring-2 focus:ring-focus-ring"
        />

        <span className="text-sm text-text-primary">Actividad activa</span>
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover sm:flex-1"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-600 disabled:opacity-60 sm:flex-1"
        >
          {isSubmitting
            ? editingActivity
              ? "Guardando..."
              : "Creando..."
            : editingActivity
              ? "Guardar cambios"
              : "Crear actividad"}
        </button>
      </div>
    </form>
  );
}

export default ActivityForm;
