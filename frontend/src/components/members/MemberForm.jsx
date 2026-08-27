import { Dumbbell, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { DAY_NAMES } from "../../constants/days";
import { formatCurrency } from "../../utils/currency.utils";
import PlanSelector from "../plans/PlanSelector";

const DAYS_LIST = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sábado" },
];

const EMPTY_HOURS = [];

function formatTime(t) {
  if (!t) return "";
  return t.slice(0, 5);
}

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
  availableActivities,
  loadingActivities,
  activitiesAvailable,
}) {
  if (!formData) return null;

  const schedules = formData.schedules || [];
  const services = formData.services || ["gym"];
  const activitySelections = formData.activity_schedules || [];

  const hasGym = services.includes("gym");
  const hasActivities = services.includes("activities");

  const plans = availablePlans || [];
  const selectedPlan = plans.find((p) => p.id === formData.plan_id);
  const limit = selectedPlan ? selectedPlan.weekly_visits : null;
  const scheduleCount = schedules.length;
  const atLimit = limit !== null && scheduleCount >= limit;

  const activities = availableActivities || [];

  const [expandedActivity, setExpandedActivity] = useState(null);

  function handleServiceToggle(key) {
    if (key === "activities" && !activitiesAvailable) return;
    const next = services.includes(key)
      ? services.filter((s) => s !== key)
      : [...services, key];
    if (next.length === 0) return;
    setFormData({ ...formData, services: next });
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

  function getHoursForDay(day) {
    if (!availableSlots || availableSlots.length === 0) return EMPTY_HOURS;
    return availableSlots
      .filter((s) => s.day === day)
      .map((s) => s.hour.slice(0, 5))
      .sort();
  }

  function isActivityScheduleSelected(scheduleId) {
    return activitySelections.some((s) => s.schedule_id === scheduleId);
  }

  function handleActivityToggle(activityId, scheduleId, availableSpots) {
    if (availableSpots !== undefined && availableSpots <= 0) return;
    if (isActivityScheduleSelected(scheduleId)) {
      setFormData({
        ...formData,
        activity_schedules: activitySelections.filter(
          (s) => s.schedule_id !== scheduleId,
        ),
      });
    } else {
      setFormData({
        ...formData,
        activity_schedules: [
          ...activitySelections,
          { activity_id: activityId, schedule_id: scheduleId },
        ],
      });
    }
  }

  function getActivitySelectionCount(activityId) {
    return activitySelections.filter((s) => s.activity_id === activityId).length;
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
          setFormData({ ...formData, first_name: e.target.value })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      />

      <input
        type="text"
        placeholder="Apellido"
        value={formData.last_name}
        onChange={(e) =>
          setFormData({ ...formData, last_name: e.target.value })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      />

      <input
        type="text"
        placeholder="Teléfono"
        value={formData.phone}
        onChange={(e) =>
          setFormData({ ...formData, phone: e.target.value })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      />

      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) =>
          setFormData({ ...formData, email: e.target.value })
        }
        className="w-full rounded-xl bg-surface-input px-4 py-3 text-text-primary outline-none"
      />

      <div>
        <label className="mb-1 block text-sm text-text-secondary">Foto</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setFormData({ ...formData, photo: e.target.files[0] })
          }
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary"
        />
      </div>

      {!editingMember && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-primary">
            Servicios
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleServiceToggle("gym")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                hasGym
                  ? "border-info bg-info text-white"
                  : "border-border bg-surface-input text-text-secondary"
              }`}
            >
              <Dumbbell size={18} />
              Gimnasio
            </button>
            <button
              type="button"
              onClick={() => handleServiceToggle("activities")}
              disabled={!activitiesAvailable}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                hasActivities
                  ? "border-info bg-info text-white"
                  : activitiesAvailable
                    ? "border-border bg-surface-input text-text-secondary"
                    : "border-border/30 bg-surface-input/50 text-text-secondary/50 cursor-not-allowed"
              }`}
            >
              <Sparkles size={18} />
              Actividades
            </button>
          </div>
        </div>
      )}

      {hasGym && (
        <>
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
                {DAYS_LIST.map((day) => {
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
                            className="h-5 w-5 rounded border border-border bg-surface-input text-blue-500"
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
        </>
      )}

      {hasActivities && (
        <div className="rounded-lg bg-surface-input border border-border p-4">
          <p className="mb-2 text-sm font-medium text-text-primary">
            Actividades
          </p>

          {activitySelections.length > 0 && (
            <p className="mb-2 text-xs text-info">
              {activitySelections.length} horario{activitySelections.length !== 1 ? "s" : ""} seleccionado{activitySelections.length !== 1 ? "s" : ""}
            </p>
          )}

          {loadingActivities ? (
            <p className="text-sm text-text-secondary">Cargando actividades...</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No hay actividades disponibles.
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => {
                const count = getActivitySelectionCount(activity.id);
                const isExpanded = expandedActivity === activity.id;

                return (
                  <div
                    key={activity.id}
                    className="rounded-xl border border-border bg-surface-elevated overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedActivity(isExpanded ? null : activity.id)}
                      className="flex w-full items-center justify-between p-4 text-left"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-text-primary">
                            {activity.name}
                          </h3>
                          {count > 0 && (
                            <span className="rounded-full bg-info/15 px-2 py-0.5 text-xs font-medium text-info">
                              {count}
                            </span>
                          )}
                        </div>
                        {activity.description && (
                          <p className="mt-0.5 text-sm text-text-secondary line-clamp-1">
                            {activity.description}
                          </p>
                        )}
                        {activity.monthly_price && Number(activity.monthly_price) > 0 && (
                          <p className="mt-1 text-sm font-semibold text-info-text dark:text-info">
                            {formatCurrency(activity.monthly_price)}/mes
                          </p>
                        )}
                      </div>

                      {isExpanded ? (
                        <ChevronUp size={18} className="shrink-0 text-text-secondary" />
                      ) : (
                        <ChevronDown size={18} className="shrink-0 text-text-secondary" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3">
                        {activity.schedules && activity.schedules.length > 0 ? (
                          <div className="space-y-2">
                            {activity.schedules.map((schedule) => {
                              const selected = isActivityScheduleSelected(schedule.id);
                              const isFull = schedule.available_spots !== undefined && schedule.available_spots <= 0;

                              return (
                                <div
                                  key={schedule.id}
                                  onClick={() => !isFull && handleActivityToggle(activity.id, schedule.id, schedule.available_spots)}
                                  role="button"
                                  tabIndex={isFull ? -1 : 0}
                                  onKeyDown={(e) => {
                                    if (!isFull && (e.key === "Enter" || e.key === " ")) {
                                      e.preventDefault();
                                      handleActivityToggle(activity.id, schedule.id, schedule.available_spots);
                                    }
                                  }}
                                  className={`flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-0 sm:justify-between rounded-lg border p-3 transition ${
                                    isFull
                                      ? "border-border bg-surface-input opacity-50 cursor-not-allowed"
                                      : selected
                                        ? "cursor-pointer border-info bg-info-bg"
                                        : "cursor-pointer border-border bg-surface-input hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-start gap-3 sm:items-center">
                                    <div className={`mt-0.5 shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center ${
                                      isFull
                                        ? "border-text-secondary/40 bg-surface-input"
                                        : selected
                                          ? "border-info bg-info"
                                          : "border-text-secondary"
                                    }`}>
                                      {selected && (
                                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>

                                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3 min-w-0">
                                      <span className="text-sm text-text-primary">
                                        {DAY_NAMES[schedule.day] || schedule.day}
                                      </span>
                                      <span className="text-sm text-text-secondary">
                                        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                                      </span>
                                    </div>
                                  </div>

                                  <span className={`text-xs ${
                                    schedule.available_spots > 0
                                      ? "text-text-secondary"
                                      : "text-danger"
                                  }`}>
                                    {schedule.available_spots > 0
                                      ? `${schedule.available_spots} cupo${schedule.available_spots !== 1 ? "s" : ""}`
                                      : "Completo"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-text-secondary">
                            No hay horarios disponibles para esta actividad.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
