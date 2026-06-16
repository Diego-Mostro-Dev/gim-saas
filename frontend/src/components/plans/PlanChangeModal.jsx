import { useState, useMemo } from "react";
import { X, ChevronLeft, Check, AlertTriangle } from "lucide-react";
import { DAY_NAMES } from "../../constants/days";

function PlanChangeModal({
  onClose,
  currentSubscription,
  currentSchedules,
  availablePlans,
  allSlots,
  onCreateRequest,
}) {
  // State is fresh every mount because parent uses key={showPlanModal}
  const [step, setStep] = useState("select");
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [targetSchedules, setTargetSchedules] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const selectedPlan = useMemo(() => {
    if (!selectedPlanId) return null;
    return availablePlans.find((p) => p.id === selectedPlanId) || null;
  }, [selectedPlanId, availablePlans]);

  const currentPlanId = currentSubscription?.plan_id;

  const weeklyLabel = (visits) => {
    if (visits === null || visits === undefined) return "Acceso ilimitado";
    return `${visits} visitas/semana`;
  };

  const availableSlotOptions = useMemo(() => {
    return allSlots.map((slot) => ({
      ...slot,
      label: `${DAY_NAMES[slot.day] || slot.day} ${slot.hour}`,
    }));
  }, [allSlots]);

  const currentSlotKeys = useMemo(() => {
    return new Set(
      currentSchedules.map((s) => `${s.day}|${s.hour}`)
    );
  }, [currentSchedules]);

  function isSelected(slot) {
    return targetSchedules.some(
      (s) => s.day === slot.day && s.hour === slot.hour
    );
  }

  function handleToggleSlot(slot) {
    setTargetSchedules((prev) => {
      const exists = prev.some(
        (s) => s.day === slot.day && s.hour === slot.hour
      );
      if (exists) {
        return prev.filter(
          (s) => !(s.day === slot.day && s.hour === slot.hour)
        );
      }
      return [...prev, { day: slot.day, hour: slot.hour }];
    });
  }

  function handleSelectPlan(planId) {
    if (planId === currentPlanId) return;
    setSelectedPlanId(planId);

    const plan = availablePlans.find((p) => p.id === planId);
    if (!plan) return;

    const newVisits = plan.weekly_visits;
    const isUnlimited = newVisits === null;

    let initialTargets;
    if (isUnlimited) {
      initialTargets = currentSchedules.map((s) => ({
        day: s.day,
        hour: s.hour,
      }));
    } else if (newVisits <= currentSchedules.length) {
      initialTargets = currentSchedules.slice(0, newVisits).map((s) => ({
        day: s.day,
        hour: s.hour,
      }));
    } else {
      initialTargets = currentSchedules.map((s) => ({
        day: s.day,
        hour: s.hour,
      }));
    }
    setTargetSchedules(initialTargets);
    setStep("schedules");
  }

  function getHelperMessage() {
    if (!selectedPlan || !currentSubscription) return "";
    const currentVisits = currentSubscription.plan_weekly_visits;
    const newVisits = selectedPlan.weekly_visits;

    if (newVisits === null) {
      return "Este plan permite horarios ilimitados. Configurá tus horarios libremente.";
    }
    if (currentVisits === null) {
      return `Tu nuevo plan permite ${newVisits} horarios. Seleccioná los horarios que querés.`;
    }
    if (newVisits > currentVisits) {
      const addCount = newVisits - currentSchedules.length;
      if (addCount > 0) {
        return `Tu nuevo plan permite ${newVisits} horarios. Seleccioná ${addCount} horarios adicionales.`;
      }
      return `Tu nuevo plan permite ${newVisits} horarios.`;
    }
    if (newVisits < currentVisits) {
      return `Seleccioná los ${newVisits} horarios que querés conservar.`;
    }
    return "";
  }

  function canProceed() {
    if (!selectedPlan) return false;
    const limit = selectedPlan.weekly_visits;
    if (limit === null) return targetSchedules.length > 0;
    return targetSchedules.length === limit;
  }

  function getValidationError() {
    if (!selectedPlan) return "Seleccioná un plan.";
    const limit = selectedPlan.weekly_visits;
    if (limit === null) {
      if (targetSchedules.length === 0) return "Seleccioná al menos un horario.";
      return null;
    }
    if (targetSchedules.length !== limit) {
      return `Debés seleccionar exactamente ${limit} horarios.`;
    }
    return null;
  }

  async function handleSubmit() {
    if (!canProceed() || submitting) return;
    setSubmitting(true);

    try {
      await onCreateRequest({
        requested_plan: selectedPlanId,
        target_schedules_snapshot: targetSchedules,
      });
      onClose();
    } catch {
      // error toast handled by caller
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 pt-10 pb-10">
      <div className="w-full max-w-lg rounded-3xl border border-border/10 bg-surface-modal shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-border/5 px-6 py-4">
          <div className="flex items-center gap-3">
            {step === "schedules" && (
              <button
                onClick={() => setStep("select")}
                className="text-text-secondary transition hover:text-text-primary"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <h2 className="text-lg font-semibold text-text-primary">
              {step === "select" ? "Solicitar cambio de plan" : "Configurar horarios"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary transition hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {step === "select" && (
            <>
              {currentSubscription && (
                <div className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Plan actual
                  </p>
                  <h3 className="text-base font-bold text-text-primary">
                    {currentSubscription.plan}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {weeklyLabel(currentSubscription.plan_weekly_visits)}
                  </p>
                </div>
              )}

              <p className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
                Seleccioná un nuevo plan
              </p>

              {availablePlans
                .filter((p) => p.id !== currentPlanId)
                .map((plan) => {
                  const isActive = selectedPlanId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => handleSelectPlan(plan.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        isActive
                          ? "border-info bg-info-bg"
                          : "border-border bg-surface hover:border-border/20"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-text-primary">{plan.name}</h3>
                          <p className="text-sm text-text-secondary">
                            {plan.duration_days} días
                          </p>
                          <p className="text-sm text-blue-400">
                            {weeklyLabel(plan.weekly_visits)}
                          </p>
                          {plan.description && (
                            <p className="mt-1 text-xs text-text-secondary">
                              {plan.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-info-text dark:text-info">
                            ${Number(plan.price).toLocaleString("es-AR")}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </>
          )}

          {step === "schedules" && selectedPlan && (
            <>
              <div className="rounded-2xl border border-info/20 bg-info-bg/50 p-4 dark:bg-info/15">
                <p className="text-sm text-info-text dark:text-info">{getHelperMessage()}</p>
              </div>

              {selectedPlan.weekly_visits !== null && (
                <div className="flex justify-between rounded-xl bg-surface-input px-4 py-3">
                  <span className="text-sm text-text-secondary">Horarios seleccionados</span>
                  <span className="text-sm font-medium text-text-primary">
                    {targetSchedules.length} / {selectedPlan.weekly_visits}
                  </span>
                </div>
              )}

              {selectedPlan.weekly_visits === null && targetSchedules.length > 0 && (
                <div className="flex justify-between rounded-xl bg-surface-input px-4 py-3">
                  <span className="text-sm text-text-secondary">Horarios seleccionados</span>
                  <span className="text-sm font-medium text-text-primary">
                    {targetSchedules.length}
                  </span>
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableSlotOptions.map((slot) => {
                  const selected = isSelected(slot);
                  const isCurrent = currentSlotKeys.has(`${slot.day}|${slot.hour}`);
                  return (
                    <div
                      key={slot.id}
                      onClick={() => handleToggleSlot(slot)}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition ${
                        selected
                          ? "border-info bg-info-bg"
                          : "border-border bg-surface-input hover:border-border/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded border ${
                            selected
                              ? "border-info bg-info"
                              : "border-zinc-600"
                          }`}
                        >
                          {selected && <Check size={14} className="text-white" />}
                        </div>
                        <span className="text-sm text-text-primary">
                          {DAY_NAMES[slot.day] || slot.day} {slot.hour}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="text-xs text-text-secondary">Actual</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {getValidationError() && (
                <div className="flex items-center gap-2 rounded-xl bg-warning-bg dark:bg-warning/10 px-4 py-3">
                  <AlertTriangle size={16} className="text-warning-text dark:text-warning" />
                  <p className="text-sm text-warning-text dark:text-warning">{getValidationError()}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canProceed() || submitting}
                className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Enviando..." : "Enviar solicitud"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlanChangeModal;
