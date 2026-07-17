import { DAY_NAMES } from "../../constants/days";
import { formatCurrency } from "../../utils/currency.utils";
import ValidationBanner from "../ui/ValidationBanner";

function ReviewStep({
  formData,
  services,
  plans,
  selectedPlanId,
  schedules,
  activities,
  activitySelections,
  validationMessage,
  onEditPersonal,
  onEditServices,
  onEditGym,
  onEditActivities,
}) {
  const plan = plans.find((p) => p.id === selectedPlanId);

  function getActivity(activityId) {
    return activities.find((a) => a.id === activityId) || null;
  }

  function findSchedule(scheduleId) {
    for (const a of activities) {
      const s = a.schedules?.find((s) => s.id === scheduleId);
      if (s) return { activity: a, schedule: s };
    }
    return null;
  }

  function formatTime(t) {
    if (!t) return "";
    return t.slice(0, 5);
  }

  function groupSelectionsByActivity() {
    const map = new Map();
    for (const sel of activitySelections) {
      if (!map.has(sel.activity_id)) {
        const activity = getActivity(sel.activity_id);
        map.set(sel.activity_id, {
          activityId: sel.activity_id,
          name: activity?.name || "?",
          monthlyPrice: Number(activity?.monthly_price || 0),
          schedules: [],
        });
      }
      const found = findSchedule(sel.schedule_id);
      if (found) {
        map.get(sel.activity_id).schedules.push({
          day: DAY_NAMES[found.schedule.day] || found.schedule.day,
          time: `${formatTime(found.schedule.start_time)} - ${formatTime(found.schedule.end_time)}`,
        });
      }
    }
    return Array.from(map.values());
  }

  const groupedActivities = groupSelectionsByActivity();
  const distinctActivityCount = groupedActivities.length;

  const activitiesTotal = groupedActivities.reduce(
    (sum, a) => sum + a.monthlyPrice,
    0,
  );

  const planPrice = plan ? Number(plan.price) : 0;
  const monthlyTotal = planPrice + activitiesTotal;

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-text-primary">
        Revisá tus datos antes de confirmar
      </p>

      {validationMessage && <ValidationBanner message={validationMessage} />}

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
              <Row label="Precio" value={formatCurrency(plan.price)} />
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
        <Section title="Actividades" onEdit={onEditActivities}>
          {groupedActivities.length > 0 ? (
            <div className="space-y-3">
              {groupedActivities.map((a) => (
                <div
                  key={a.activityId}
                  className="rounded-lg bg-surface-input px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text-primary">
                      {a.name}
                    </p>
                    {a.monthlyPrice > 0 && (
                      <span className="text-sm font-semibold text-info-text dark:text-info">
                        {formatCurrency(a.monthlyPrice)}/mes
                      </span>
                    )}
                  </div>
                  {a.schedules.length > 0 && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {a.schedules.map((s, i) => (
                        <p key={i} className="text-xs text-text-secondary">
                          {s.day} {s.time}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              No seleccionaste actividades.
            </p>
          )}
        </Section>
      )}

      {/* Summary */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          Resumen
        </p>

        {services.gym && plan && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Plan de gimnasio</span>
            <span className="text-sm font-medium text-text-primary">
              {formatCurrency(plan.price)}
            </span>
          </div>
        )}

        {services.activities && groupedActivities.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">
                Actividades ({distinctActivityCount})
              </span>
              <span className="text-sm font-medium text-text-primary">
                {formatCurrency(activitiesTotal)}
              </span>
            </div>
            <div className="flex flex-col gap-1 pl-2">
              {groupedActivities.map((a) => (
                <div key={a.activityId} className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">
                    {a.name}
                  </span>
                  {a.monthlyPrice > 0 && (
                    <span className="text-xs text-text-secondary">
                      {formatCurrency(a.monthlyPrice)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="border-t border-border pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-text-primary">
            Total mensual estimado
          </span>
          <span className="text-lg font-bold text-info-text dark:text-info">
            {formatCurrency(monthlyTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, onEdit }) {
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
