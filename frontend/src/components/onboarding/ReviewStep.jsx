import { DAY_NAMES } from "../../constants/days";

function ReviewStep({
  formData,
  services,
  plans,
  selectedPlanId,
  schedules,
  activities,
  activitySelections,
  onEditPersonal,
  onEditServices,
  onEditGym,
  onEditActivities,
}) {
  const plan = plans.find((p) => p.id === selectedPlanId);

  function getActivityName(activityId) {
    const a = activities.find((a) => a.id === activityId);
    return a ? a.name : "?";
  }

  function getActivityScheduleInfo(scheduleId) {
    for (const a of activities) {
      const s = a.schedules?.find((s) => s.id === scheduleId);
      if (s) {
        return {
          activityName: a.name,
          day: DAY_NAMES[s.day] || s.day,
          time: `${s.start_time?.slice(0, 5)} - ${s.end_time?.slice(0, 5)}`,
        };
      }
    }
    return null;
  }

  function formatTime(t) {
    if (!t) return "";
    return t.slice(0, 5);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-text-primary">
        Revisá tus datos antes de confirmar
      </p>

      {/* Personal info */}
      <Section title="Información personal" onEdit={onEditPersonal}>
        <Row label="Nombre" value={`${formData.first_name} ${formData.last_name}`} />
        <Row label="Teléfono" value={formData.phone} />
        {formData.email && <Row label="Email" value={formData.email} />}
      </Section>

      {/* Services */}
      <Section title="Servicios seleccionados" onEdit={onEditServices}>
        <div className="flex gap-2">
          {services.gym && (
            <span className="rounded-full bg-info/15 px-3 py-1 text-xs font-medium text-info">
              Gimnasio
            </span>
          )}
          {services.activities && (
            <span className="rounded-full bg-info/15 px-3 py-1 text-xs font-medium text-info">
              Actividades
            </span>
          )}
        </div>
      </Section>

      {/* Gym section */}
      {services.gym && (
        <Section title="Plan de gimnasio" onEdit={onEditGym}>
          {plan ? (
            <>
              <Row label="Plan" value={plan.name} />
              <Row label="Precio" value={`$${plan.price}`} />
              {plan.weekly_visits && (
                <Row label="Visitas semanales" value={`${plan.weekly_visits}`} />
              )}
              <Row
                label="Duración"
                value={`${plan.duration_days} días`}
              />
            </>
          ) : (
            <p className="text-sm text-warning-text">Sin plan seleccionado</p>
          )}

          {schedules.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-text-secondary mb-1">Horarios:</p>
              <div className="flex flex-wrap gap-1">
                {schedules.map((s, i) => (
                  <span
                    key={i}
                    className="rounded bg-surface-input px-2 py-0.5 text-xs text-text-primary"
                  >
                    {DAY_NAMES[s.day] || s.day} {formatTime(s.hour)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Activities section */}
      {services.activities && (
        <Section
          title="Actividades"
          onEdit={onEditActivities}
          note={!services.gym ? "Suscripción pendiente de implementación" : undefined}
        >
          {activitySelections.length > 0 ? (
            <div className="space-y-2">
              {activitySelections.map((sel, i) => {
                const info = getActivityScheduleInfo(sel.schedule_id);
                return (
                  <div
                    key={i}
                    className="rounded-lg bg-surface-input px-3 py-2"
                  >
                    <p className="text-sm font-medium text-text-primary">
                      {info?.activityName || getActivityName(sel.activity_id)}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {info?.day} · {info?.time}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No seleccionaste horarios de actividades.
            </p>
          )}
        </Section>
      )}

      {/* Total */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">
            Total estimado
          </span>
          <span className="text-lg font-bold text-info">
            {plan ? `$${plan.price}` : "—"}
          </span>
        </div>
        {services.activities && (
          <p className="mt-1 text-xs text-text-secondary">
            El precio de las actividades se definirá próximamente.
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ title, children, onEdit, note }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          {title}
        </p>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs text-info hover:underline"
          >
            Editar
          </button>
        )}
      </div>
      {note && (
        <p className="mb-2 text-xs text-warning-text">{note}</p>
      )}
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}

export default ReviewStep;
