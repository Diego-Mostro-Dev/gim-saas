import PlanSelector from "../plans/PlanSelector";

const DAYS = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sábado" },
];

function GymStep({
  plans,
  slots,
  selectedPlanId,
  onSelectPlan,
  schedules,
  onToggleDay,
  onHourChange,
}) {
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const limit = selectedPlan ? selectedPlan.weekly_visits : null;
  const scheduleCount = schedules.length;
  const atLimit = limit !== null && scheduleCount >= limit;

  function getHoursForDay(day) {
    if (slots && slots.length > 0) {
      return slots
        .filter((s) => s.day === day)
        .map((s) => s.hour.slice(0, 5))
        .sort();
    }
    return [];
  }

  function handleToggleDay(day) {
    if (schedules.find((s) => s.day === day)) {
      onToggleDay(schedules.filter((s) => s.day !== day));
      return;
    }
    if (atLimit) return;
    const hours = getHoursForDay(day);
    if (hours.length === 0) return;
    onToggleDay([...schedules, { day, hour: hours[0] }]);
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
    <div className="space-y-6">
      <div>
        <h3 className="mb-1 text-sm font-medium text-text-primary">
          Elegí tu plan de gimnasio
        </h3>
        <p className="mb-3 text-sm text-text-secondary">
          Cada plan incluye un límite de visitas semanales.
        </p>

        {plans.length > 0 ? (
          <PlanSelector
            plans={plans}
            selectedPlanId={selectedPlanId}
            onSelect={onSelectPlan}
          />
        ) : (
          <p className="text-sm text-text-secondary">
            No hay planes disponibles.
          </p>
        )}
      </div>

      {selectedPlan && (
        <div className="rounded-lg border border-border bg-surface-input p-4">
          <p className="mb-2 text-sm font-medium text-text-primary">
            Horarios de asistencia al gimnasio
          </p>

          {limit !== null && (
            <p className="mb-2 text-sm text-text-secondary">
              Seleccionados: {scheduleCount} de {limit}
            </p>
          )}

          {limit === null && (
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
            {DAYS.map((day) => {
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
                        onChange={(e) => {
                          const updated = schedules.map((s) =>
                            s.day === day.value ? { ...s, hour: e.target.value } : s
                          );
                          onHourChange(updated);
                        }}
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
    </div>
  );
}

export default GymStep;
