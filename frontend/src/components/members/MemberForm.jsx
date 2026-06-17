import PlanSelector from "../plans/PlanSelector";

function MemberForm({
  formData,
  setFormData,
  onSubmit,
  editingMember,
  isSubmitting,
  availableSlots,
  loadingSlots,
  availablePlans,
  loadingPlans,
}) {
  if (!formData) return null;

  const schedules = formData.schedules || [];

  const plans = availablePlans || [];
  const selectedPlan = plans.find((p) => p.id === formData.plan_id);
  const limit = selectedPlan ? selectedPlan.weekly_visits : null;
  const scheduleCount = schedules.length;
  const atLimit = limit !== null && scheduleCount >= limit;

  const days = [
    { value: "monday", label: "Lunes" },
    { value: "tuesday", label: "Martes" },
    { value: "wednesday", label: "Miércoles" },
    { value: "thursday", label: "Jueves" },
    { value: "friday", label: "Viernes" },
    { value: "saturday", label: "Sábado" },
  ];

  const FALLBACK_HOURS = [
    "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
    "19:00", "20:00", "21:00",
  ];

  function getHoursForDay(day) {
    if (availableSlots && availableSlots.length > 0) {
      return availableSlots
        .filter((s) => s.day === day)
        .map((s) => s.hour.slice(0, 5))
        .sort();
    }
    return availableSlots ? [] : FALLBACK_HOURS;
  }

  function handleToggleDay(day) {
    const exists = schedules.find((s) => s.day === day);

    if (exists) {
      setFormData({
        ...formData,
        schedules: schedules.filter((s) => s.day !== day),
      });
      return;
    }

    if (atLimit) return;

    const hours = getHoursForDay(day);
    if (hours.length === 0) return;

    setFormData({
      ...formData,
      schedules: [...schedules, { day, hour: hours[0] }],
    });
  }

  function handleHourChange(day, hour) {
    setFormData({
      ...formData,
      schedules: schedules.map((s) => (s.day === day ? { ...s, hour } : s)),
    });
  }

  function isSelected(day) {
    return schedules.some((s) => s.day === day);
  }

  function getHour(day) {
    const current = schedules.find((s) => s.day === day);
    if (current) return current.hour;
    const hours = getHoursForDay(day);
    return hours.length > 0 ? hours[0] : "";
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 space-y-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-text-primary">
        {editingMember ? "Editar miembro" : "Nuevo miembro"}
      </h2>

      <input
        type="text"
        placeholder="Nombre"
        value={formData.first_name}
        onChange={(e) =>
          setFormData({
            ...formData,
            first_name: e.target.value,
          })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      />
    
      <input
        type="text"
        placeholder="Apellido"
        value={formData.last_name}
        onChange={(e) =>
          setFormData({
            ...formData,
            last_name: e.target.value,
          })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      />
    
      <input
        type="text"
        placeholder="Teléfono"
        value={formData.phone}
        onChange={(e) =>
          setFormData({
            ...formData,
            phone: e.target.value,
          })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      />
    
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) =>
          setFormData({
            ...formData,
            email: e.target.value,
          })
        }
        className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary outline-none"
      />

      <div>
        <label className="mb-1 block text-sm text-text-secondary">Foto</label>

        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setFormData({
              ...formData,
              photo: e.target.files[0],
            })
          }
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary"
        />
      </div>

      {!loadingPlans && plans.length > 0 && (
        <PlanSelector
          plans={availablePlans}
          selectedPlanId={formData.plan_id}
          onSelect={(id) =>
            setFormData({ ...formData, plan_id: id })
          }
        />
      )}

      {plans.length > 0 && !selectedPlan ? (
        <div className="rounded-lg bg-surface-input border border-border p-4">
          <p className="text-sm text-text-secondary">
            Elegí primero un plan para seleccionar tus horarios.
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-surface-input border border-border p-4">
          <p className="mb-2 text-sm font-medium text-text-primary">
            Horarios de asistencia
          </p>

          {selectedPlan && limit !== null && (
            <p className="mb-2 text-sm text-text-secondary">
              Seleccionados: {scheduleCount} de {limit}
            </p>
          )}

          {selectedPlan && limit === null && (
            <p className="mb-2 text-sm text-text-secondary">
              Selección ilimitada de horarios.
            </p>
          )}

          {atLimit && (
            <p className="mb-2 text-xs text-warning-text dark:text-warning">
              Este plan permite un máximo de {limit} horarios semanales.
            </p>
          )}

          <div className="space-y-3">
            {days.map((day) => {
              const selected = isSelected(day.value);

              return (
                <div key={day.value} className="rounded-xl bg-surface-elevated p-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={!selected && atLimit}
                        onChange={() => handleToggleDay(day.value)}
                      />
                      {day.label}
                    </label>

                    {selected && (
                      <select
                        value={getHour(day.value)}
                        onChange={(e) =>
                          handleHourChange(day.value, e.target.value)
                        }
                        className="rounded-lg border border-border bg-surface-input px-3 py-1 text-sm text-text-primary outline-none"
                      >
                        {getHoursForDay(day.value).map((hour) => (
                          <option
                            key={hour}
                            value={hour}
                            className="bg-surface-input text-text-primary"
                          >
                            {hour}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-blue-500 py-3 font-medium text-white"
      >
        {isSubmitting
          ? editingMember
            ? "Guardando..."
            : "Creando..."
          : editingMember
            ? "Guardar cambios"
            : "Crear miembro"}
      </button>
    </form>
  );
}

export default MemberForm;
