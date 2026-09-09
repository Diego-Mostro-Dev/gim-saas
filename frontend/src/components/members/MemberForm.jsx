import { Dumbbell, Sparkles, ChevronDown, ChevronUp, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DAY_NAMES } from "../../constants/days";
import { formatCurrency } from "../../utils/currency.utils";
import { txt } from "../../utils/labels";
import PlanSelector from "../plans/PlanSelector";

const DAYS_LIST = [
  { value: "monday", label: "Lunes" },
  { value: "tuesday", label: "Martes" },
  { value: "wednesday", label: "Miércoles" },
  { value: "thursday", label: "Jueves" },
  { value: "friday", label: "Viernes" },
  { value: "saturday", label: "Sábado" },
  { value: "sunday", label: "Domingo" },
];

const EMPTY_HOURS = [];

function formatTime(t) {
  if (!t) return "";
  return t.slice(0, 5);
}

function MemberForm({
  gym,
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
  availableInsurances,
  availableDiscounts,
}) {
  const [expandedActivity, setExpandedActivity] = useState(null);

  const insurances = availableInsurances || [];

  // Combobox de obra social
  const [insuranceQuery, setInsuranceQuery] = useState(() => {
    if (!formData) return "";
    const sel = insurances.find((i) => i.id === Number(formData.insurance));
    return sel ? sel.name : formData.health_insurance || "";
  });
  const [insuranceOpen, setInsuranceOpen] = useState(false);
  const insuranceBoxRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (insuranceBoxRef.current && !insuranceBoxRef.current.contains(e.target)) {
        setInsuranceOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const insuranceMatches = insurances.filter((ins) => {
    const q = insuranceQuery.trim().toLowerCase();
    if (!q) return true;
    return ins.name.toLowerCase().includes(q);
  });

  function handleInsurancePick(ins, clear = false) {
    setInsuranceOpen(false);
    if (clear) {
      setInsuranceQuery("");
      setFormData({ ...formData, insurance: "", health_insurance: "" });
      return;
    }
    setInsuranceQuery(ins.name);
    setFormData({
      ...formData,
      insurance: ins.id,
      health_insurance: ins.name,
    });
  }

  function handleInsuranceInput(value) {
    setInsuranceQuery(value);
    setInsuranceOpen(true);
    const ins = insurances.find((i) => i.name.toLowerCase() === value.toLowerCase());
    if (ins) {
      setFormData({ ...formData, insurance: ins.id, health_insurance: ins.name });
    } else {
      setFormData({ ...formData, insurance: "", health_insurance: value });
    }
  }

  if (!formData) return null;

  const schedules = formData.schedules || [];
  const services = formData.services || ["gym"];
  const activitySelections = formData.activity_schedules || [];

  const hasGym = services.includes("gym");
  const hasActivities = services.includes("activities");
  const showBillingSections = !editingMember || !formData.is_comp;

  const plans = availablePlans || [];
  const selectedPlan = plans.find((p) => p.id === formData.plan_id);
  const limit = selectedPlan ? selectedPlan.weekly_visits : null;
  const scheduleCount = schedules.length;
  const atLimit = limit !== null && scheduleCount >= limit;

  const activities = availableActivities || [];

  const discounts = availableDiscounts || [];
  const selectedDiscount = discounts.find(
    (d) => String(d.id) === String(formData.discount_id || ""),
  );

  function discountedPrice(price) {
    if (!selectedDiscount) return Number(price || 0);
    return Number(price || 0) * (1 - selectedDiscount.discount_percent / 100);
  }

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

      <input
        type="text"
        placeholder="Nº de Documento"
        value={formData.document_number}
        onChange={(e) =>
          setFormData({ ...formData, document_number: e.target.value })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        required
      />

      <div>
        <label className="mb-1 block text-sm text-text-secondary">
          Fecha de nacimiento
        </label>
        <input
          type="date"
          value={formData.date_of_birth}
          onChange={(e) =>
            setFormData({ ...formData, date_of_birth: e.target.value })
          }
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-text-secondary">
          Obra social / Seguro médico
        </label>
        <div ref={insuranceBoxRef} className="relative">
          <input
            type="text"
            placeholder={
              insurances.length > 0
                ? "Buscá o escribí la obra social (ej: IAPOS)"
                : "Obra social / Seguro médico (opcional)"
            }
            value={insuranceQuery}
            onChange={(e) => handleInsuranceInput(e.target.value)}
            onFocus={() => {
              setInsuranceOpen(true);
            }}
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />

          {insuranceOpen && insurances.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-surface-elevated p-1 shadow-xl">
              <button
                type="button"
                onClick={() => handleInsurancePick(null, true)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-text-primary transition hover:bg-surface-input"
              >
                <span>Sin obra social</span>
                {(formData.insurance === "" || formData.insurance == null) &&
                  !insuranceQuery.trim() && (
                    <Check size={15} className="text-primary" />
                  )}
              </button>

              {insuranceMatches.length === 0 ? (
                <div className="px-3 py-2 text-xs text-text-secondary">
                  No se encontró. Se guardará como texto libre.
                </div>
              ) : (
                insuranceMatches.map((ins) => {
                  const coseguro =
                    ins.session_price == null
                      ? null
                      : Number(ins.session_price).toLocaleString("es-AR");
                  const sellado =
                    ins.sellado_amount == null
                      ? null
                      : Number(ins.sellado_amount).toLocaleString("es-AR");
                  const isSelected = Number(formData.insurance) === ins.id;
                  return (
                    <button
                      key={ins.id}
                      type="button"
                      onClick={() => handleInsurancePick(ins)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-surface-input"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-text-primary">
                          {ins.name}
                          {!ins.active ? (
                            <span className="text-text-secondary"> (inactiva)</span>
                          ) : null}
                        </span>
                        <span className="block text-xs text-text-secondary">
                          {coseguro != null
                            ? `Coseguro $${coseguro}/ses`
                            : "Sin coseguro"}
                          {sellado != null ? ` · Sellado $${sellado}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0">
                        {isSelected && (
                          <Check size={16} className="text-primary" />
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {insuranceOpen && insurances.length === 0 && (
          <p className="mt-1 text-[11px] text-text-secondary">
            Se guardará como texto libre.
          </p>
        )}
      </div>

      <input
        type="text"
        placeholder="Nº de Afiliado (opcional)"
        value={formData.affiliate_number}
        onChange={(e) =>
          setFormData({ ...formData, affiliate_number: e.target.value })
        }
        className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
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

      {editingMember && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-primary">
            Acceso
          </p>
          <button
            type="button"
            onClick={() =>
              setFormData({
                ...formData,
                is_comp: !formData.is_comp,
                discount_id: !formData.is_comp ? "" : formData.discount_id,
              })
            }
            className={`flex w-full items-center justify-between rounded-xl border p-3 text-sm font-medium transition ${
              formData.is_comp
                ? "border-warning bg-warning/15 text-warning-text dark:border-warning dark:text-warning"
                : "border-border bg-surface-input text-text-secondary"
            }`}
          >
            <span>Pase de cortesía</span>
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                formData.is_comp ? "bg-warning" : "bg-zinc-300 dark:bg-zinc-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  formData.is_comp ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </button>
        </div>
      )}

      {editingMember && formData.is_comp && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-text dark:text-warning">
          Este socio tiene acceso gratuito. Al desactivar el pase de cortesía se le pedirá elegir un plan de membresía.
        </div>
      )}

      {!editingMember && showBillingSections && (
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
              {txt(gym, "member_form.entry_gym")}
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

      {hasGym && showBillingSections && (
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

      {showBillingSections && discounts.length > 0 && (
        <div>
          <label className="mb-1 block text-sm text-text-secondary">
            Descuento
          </label>
          <select
            value={formData.discount_id || ""}
            onChange={(e) =>
              setFormData({ ...formData, discount_id: e.target.value })
            }
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          >
            <option value="">Sin descuento</option>
            {discounts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} (-{d.discount_percent}%)
              </option>
            ))}
          </select>

          {selectedDiscount && selectedPlan && (
            <p className="mt-1 text-xs text-text-secondary">
              {formatCurrency(selectedPlan.price)} →{" "}
              <span className="font-medium text-text-primary">
                {formatCurrency(
                  discountedPrice(selectedPlan.price).toFixed(2),
                )}
              </span>{" "}
              (−{selectedDiscount.discount_percent}%)
            </p>
          )}
        </div>
      )}

      {hasActivities && showBillingSections && (
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
