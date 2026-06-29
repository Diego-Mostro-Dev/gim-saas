import { DAY_NAMES, DAY_ORDER } from "../../constants/days";

function ScheduleForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSubmitting,
  editingSchedule,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-text-primary">
        {editingSchedule ? "Editar horario" : "Nuevo horario"}
      </h2>

      <div>
        <label htmlFor="schedule-day" className="mb-1 block text-sm font-medium text-text-primary">
          Día
        </label>

        <select
          id="schedule-day"
          value={formData.day}
          onChange={(e) =>
            setFormData({ ...formData, day: e.target.value })
          }
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring"
          required
        >
          <option value="" disabled>Seleccionar día</option>

          {DAY_ORDER.map((day) => (
            <option key={day} value={day}>
              {DAY_NAMES[day]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="schedule-start" className="mb-1 block text-sm font-medium text-text-primary">
            Hora inicio
          </label>

          <input
            id="schedule-start"
            type="time"
            value={formData.start_time}
            onChange={(e) =>
              setFormData({ ...formData, start_time: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring"
            required
          />
        </div>

        <div className="flex-1">
          <label htmlFor="schedule-end" className="mb-1 block text-sm font-medium text-text-primary">
            Hora fin
          </label>

          <input
            id="schedule-end"
            type="time"
            value={formData.end_time}
            onChange={(e) =>
              setFormData({ ...formData, end_time: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring"
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="schedule-capacity" className="mb-1 block text-sm font-medium text-text-primary">
          Capacidad
        </label>

        <input
          id="schedule-capacity"
          type="number"
          min="1"
          placeholder="Ej: 10"
          value={formData.capacity}
          onChange={(e) =>
            setFormData({ ...formData, capacity: Number(e.target.value) })
          }
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring"
          required
        />
      </div>

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
            ? editingSchedule
              ? "Guardando..."
              : "Creando..."
            : editingSchedule
              ? "Guardar cambios"
              : "Crear horario"}
        </button>
      </div>
    </form>
  );
}

export default ScheduleForm;
