import RouteDrawMap from "./RouteDrawMap";

function OutingForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isSubmitting,
  editingOuting,
  errors,
  trainers,
  gym,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-text-primary">
        {editingOuting ? "Editar salida" : "Nueva salida"}
      </h2>

      <div>
        <label htmlFor="outing-name" className="mb-1 block text-sm font-medium text-text-primary">
          Nombre
        </label>

        <input
          id="outing-name"
          type="text"
          placeholder="Ej: Running grupal martes, Trotada técnica"
          value={formData.name}
          onChange={(e) =>
            setFormData({ ...formData, name: e.target.value })
          }
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring"
          required
        />
        {errors?.name && (
          <p className="mt-1 text-sm text-danger-text">{errors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="outing-description" className="mb-1 block text-sm font-medium text-text-primary">
          Descripción
        </label>

        <textarea
          id="outing-description"
          placeholder="Descripción opcional de la salida"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          rows={2}
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition resize-none focus:ring-2 focus:ring-focus-ring"
        />
      </div>

      <div>
        <label htmlFor="outing-trainer" className="mb-1 block text-sm font-medium text-text-primary">
          Trainer responsable
        </label>

        <select
          id="outing-trainer"
          value={formData.trainer ?? ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              trainer: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring"
        >
          <option value="">Sin asignar</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name || t.username}
            </option>
          ))}
        </select>
        {errors?.trainer && (
          <p className="mt-1 text-sm text-danger-text">{errors.trainer}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="outing-meeting-place" className="mb-1 block text-sm font-medium text-text-primary">
            Punto de encuentro
          </label>

          <input
            id="outing-meeting-place"
            type="text"
            placeholder="Ej: Puerta del gimnasio"
            value={formData.meeting_place}
            onChange={(e) =>
              setFormData({ ...formData, meeting_place: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring"
          />
        </div>

        <div>
          <label htmlFor="outing-duration" className="mb-1 block text-sm font-medium text-text-primary">
            Duración (minutos)
          </label>

          <input
            id="outing-duration"
            type="number"
            min="1"
            placeholder="60"
            value={formData.duration_minutes ?? ""}
            onChange={(e) =>
              setFormData({ ...formData, duration_minutes: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring"
          />
        </div>
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-text-primary">
          Recorrido en el mapa
        </span>
        <p className="mb-2 text-xs text-text-secondary">
          Marcá el recorrido de la salida haciendo clic sobre el mapa. La
          distancia se calcula automáticamente y queda visible para los socios.
        </p>
        <RouteDrawMap
          value={formData.route_polyline || []}
          onChange={(polyline) => setFormData({ ...formData, route_polyline: polyline })}
          gym={gym}
        />
        {errors?.route_polyline && (
          <p className="mt-1 text-sm text-danger-text">{errors.route_polyline}</p>
        )}
      </div>

      <div>
        <label htmlFor="outing-price" className="mb-1 block text-sm font-medium text-text-primary">
          Precio mensual
        </label>

        <input
          id="outing-price"
          type="number"
          min="0"
          step="100"
          placeholder="0"
          value={formData.monthly_price ?? ""}
          onChange={(e) =>
            setFormData({ ...formData, monthly_price: e.target.value })
          }
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none transition focus:ring-2 focus:ring-focus-ring"
        />
        <p className="mt-1 text-xs text-text-secondary">
          Costo adicional por salida (0 = incluida en la membresía)
        </p>
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-text-primary">
          Modalidad de cobro
        </span>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-input px-4 py-3">
            <input
              type="radio"
              name="outing_billing_mode"
              value="monthly"
              checked={formData.billing_mode === "monthly"}
              onChange={(e) =>
                setFormData({ ...formData, billing_mode: e.target.value })
              }
              className="mt-0.5 h-4 w-4 rounded-full border border-border bg-surface-input text-blue-500 transition focus:ring-2 focus:ring-focus-ring"
            />
            <span>
              <span className="block text-sm font-medium text-text-primary">
                Mensual
              </span>
              <span className="block text-xs text-text-secondary">
                Cuota fija por mes
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-input px-4 py-3">
            <input
              type="radio"
              name="outing_billing_mode"
              value="sessions"
              checked={formData.billing_mode === "sessions"}
              onChange={(e) =>
                setFormData({ ...formData, billing_mode: e.target.value })
              }
              className="mt-0.5 h-4 w-4 rounded-full border border-border bg-surface-input text-blue-500 transition focus:ring-2 focus:ring-focus-ring"
            />
            <span>
              <span className="block text-sm font-medium text-text-primary">
                Por sesiones
              </span>
              <span className="block text-xs text-text-secondary">
                El staff inscribe a cada socio en mensual o en un paquete de N
                sesiones.
              </span>
            </span>
          </label>
        </div>
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

        <span className="text-sm text-text-primary">Salida activa</span>
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
            ? editingOuting
              ? "Guardando..."
              : "Creando..."
            : editingOuting
              ? "Guardar cambios"
              : "Crear salida"}
        </button>
      </div>
    </form>
  );
}

export default OutingForm;