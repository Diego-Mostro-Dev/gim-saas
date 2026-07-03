import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import toast from "react-hot-toast";

import {
  registerPublicMember,
  getPublicSlots,
  getPublicPlans,
  getPublicActivities,
} from "../services/publicRegister.service";

import ServiceStep from "../components/onboarding/ServiceStep";
import GymStep from "../components/onboarding/GymStep";
import ActivityStep from "../components/onboarding/ActivityStep";
import ReviewStep from "../components/onboarding/ReviewStep";

const INITIAL_FORM = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  photo: null,
};

const STEPS = {
  PERSONAL: "personal",
  SERVICES: "services",
  GYM: "gym",
  ACTIVITIES: "activities",
  REVIEW: "review",
};

const STEP_LABELS = {
  [STEPS.PERSONAL]: "Datos personales",
  [STEPS.SERVICES]: "Servicios",
  [STEPS.GYM]: "Gimnasio",
  [STEPS.ACTIVITIES]: "Actividades",
  [STEPS.REVIEW]: "Confirmar",
};

function Register() {
  const { gymCode } = useParams();

  const [stepQueue, setStepQueue] = useState([]);
  const [stepIdx, setStepIdx] = useState(0);

  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [availableSlots, setAvailableSlots] = useState([]);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [availableActivities, setAvailableActivities] = useState([]);
  const [activitiesAvailable, setActivitiesAvailable] = useState(false);

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [services, setServices] = useState({ gym: true, activities: false });
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [activitySelections, setActivitySelections] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [slots, plans] = await Promise.all([
          getPublicSlots(gymCode),
          getPublicPlans(gymCode),
        ]);
        setAvailableSlots(slots);
        setAvailablePlans(plans);

        try {
          const activities = await getPublicActivities(gymCode);
          setAvailableActivities(activities);
          setActivitiesAvailable(true);
        } catch {
          setActivitiesAvailable(false);
        }
      } catch {
        toast.error("Error al cargar datos disponibles");
      } finally {
        setLoadingData(false);
      }
    }
    load();
  }, [gymCode]);

  useEffect(() => {
    if (loadingData) return;

    const queue = [STEPS.PERSONAL, STEPS.SERVICES];
    if (services.gym) queue.push(STEPS.GYM);
    if (services.activities) queue.push(STEPS.ACTIVITIES);
    queue.push(STEPS.REVIEW);

    const maxIdx = queue.length - 1;
    setStepQueue(queue);
    setStepIdx((prev) => Math.min(prev, maxIdx));
  }, [loadingData, services.gym, services.activities]);

  if (loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-text-secondary">Cargando...</p>
      </div>
    );
  }

  function currentStep() {
    return stepQueue[stepIdx] || STEPS.PERSONAL;
  }

  function isFirst() {
    return stepIdx === 0;
  }

  function isLast() {
    return stepIdx === stepQueue.length - 1;
  }

  function goNext() {
    if (stepIdx < stepQueue.length - 1) {
      setStepIdx(stepIdx + 1);
    }
  }

  function goBack() {
    if (stepIdx > 0) {
      setStepIdx(stepIdx - 1);
    }
  }

  function goToStep(stepId) {
    const idx = stepQueue.indexOf(stepId);
    if (idx >= 0) setStepIdx(idx);
  }

  function canProceed() {
    const step = currentStep();

    switch (step) {
      case STEPS.PERSONAL:
        return formData.first_name.trim() && formData.last_name.trim() && formData.phone.trim();

      case STEPS.SERVICES:
        return services.gym || services.activities;

      case STEPS.GYM:
        return selectedPlanId !== null;

      case STEPS.ACTIVITIES:
        return activitySelections.length > 0;

      case STEPS.REVIEW:
        return true;

      default:
        return false;
    }
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const servicesList = [];
      if (services.gym) servicesList.push("gym");
      if (services.activities) servicesList.push("activities");

      const hasActivities = services.activities;

      if (!hasActivities) {
        // ── Legacy flow (Gym only) ──
        const form = new FormData();
        form.append("first_name", formData.first_name);
        form.append("last_name", formData.last_name);
        form.append("phone", formData.phone);
        form.append("email", formData.email || "");
        if (formData.photo) form.append("photo", formData.photo);
        form.append("schedules", JSON.stringify(schedules));
        if (selectedPlanId) form.append("plan_id", selectedPlanId);

        await registerPublicMember(gymCode, form);
      } else {
        // ── Multi-service flow ──
        const form = new FormData();
        form.append("first_name", formData.first_name);
        form.append("last_name", formData.last_name);
        form.append("phone", formData.phone);
        form.append("email", formData.email || "");
        if (formData.photo) form.append("photo", formData.photo);
        form.append("services", JSON.stringify(servicesList));

        if (services.gym) {
          form.append("schedules", JSON.stringify(schedules));
          if (selectedPlanId) form.append("plan_id", selectedPlanId);
        }

        if (activitySelections.length > 0) {
          form.append("activity_schedules", JSON.stringify(activitySelections));
        }

        await registerPublicMember(gymCode, form);
      }

      setSuccess(true);
      toast.success("Registro realizado correctamente");
    } catch (error) {
      toast.error(error.message || "Error al registrarse");
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ── Success screen ── */
  if (success) {
    return (
      <div className="min-h-screen bg-surface p-6 text-text-primary">
        <div className="mx-auto max-w-xl rounded-xl bg-surface-elevated p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
            <Check size={32} className="text-green-500" />
          </div>
          <h1 className="mb-2 text-3xl font-bold">¡Registro completado!</h1>
          <p className="mb-6 text-text-secondary">
            Tus datos fueron enviados correctamente.
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setFormData(INITIAL_FORM);
              setSelectedPlanId(null);
              setSchedules([]);
              setActivitySelections([]);
              setServices({ gym: true, activities: false });
              setStepIdx(0);
            }}
            className="rounded-xl bg-primary px-5 py-3 text-white"
          >
            Registrar otra persona
          </button>
        </div>
      </div>
    );
  }

  /* ── Step renderers ── */
  function renderPersonalStep() {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-text-primary">
          Completá tus datos personales
        </p>

        <input
          type="text"
          placeholder="Nombre"
          value={formData.first_name}
          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          required
        />

        <input
          type="text"
          placeholder="Apellido"
          value={formData.last_name}
          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          required
        />

        <input
          type="text"
          placeholder="Teléfono"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          required
        />

        <input
          type="email"
          placeholder="Email (opcional)"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
        />

        <div>
          <label className="mb-1 block text-sm text-text-secondary">Foto (opcional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setFormData({ ...formData, photo: e.target.files[0] })
            }
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary"
          />
        </div>
      </div>
    );
  }

  function renderServiceStep() {
    return (
      <ServiceStep
        services={services}
        onChange={setServices}
        activitiesAvailable={activitiesAvailable && availableActivities.length > 0}
      />
    );
  }

  function renderGymStep() {
    return (
      <GymStep
        plans={availablePlans}
        slots={availableSlots}
        selectedPlanId={selectedPlanId}
        onSelectPlan={setSelectedPlanId}
        schedules={schedules}
        onToggleDay={setSchedules}
        onHourChange={setSchedules}
      />
    );
  }

  function renderActivityStep() {
    return (
      <ActivityStep
        activities={availableActivities}
        selections={activitySelections}
        onChange={setActivitySelections}
      />
    );
  }

  function renderReviewStep() {
    return (
      <ReviewStep
        formData={formData}
        services={services}
        plans={availablePlans}
        selectedPlanId={selectedPlanId}
        schedules={schedules}
        activities={availableActivities}
        activitySelections={activitySelections}
        loading={isSubmitting}
        onEditPersonal={() => goToStep(STEPS.PERSONAL)}
        onEditServices={() => goToStep(STEPS.SERVICES)}
        onEditGym={() => goToStep(STEPS.GYM)}
        onEditActivities={() => goToStep(STEPS.ACTIVITIES)}
      />
    );
  }

  function renderStepContent() {
    switch (currentStep()) {
      case STEPS.PERSONAL:
        return renderPersonalStep();
      case STEPS.SERVICES:
        return renderServiceStep();
      case STEPS.GYM:
        return renderGymStep();
      case STEPS.ACTIVITIES:
        return renderActivityStep();
      case STEPS.REVIEW:
        return renderReviewStep();
      default:
        return null;
    }
  }

  /* ── Progress bar ── */
  const progressPct = ((stepIdx + 1) / stepQueue.length) * 100;

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6">
          {!isFirst() ? (
            <button
              type="button"
              onClick={goBack}
              className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
            >
              <ArrowLeft size={16} />
              Volver
            </button>
          ) : (
            <div className="h-8" />
          )}

          <h1 className="text-2xl font-bold text-text-primary">
            Registro al gimnasio
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {STEP_LABELS[currentStep()]}
          </p>

          {/* Progress bar */}
          <div className="mt-4 h-1.5 w-full rounded-full bg-surface-input">
            <div
              className="h-full rounded-full bg-info transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isLast()) {
              handleSubmit();
            } else {
              goNext();
            }
          }}
          className="mb-6 space-y-3 rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
        >
          {renderStepContent()}

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-2">
            {!isFirst() && (
              <button
                type="button"
                onClick={goBack}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium text-text-primary transition active:scale-95"
              >
                Anterior
              </button>
            )}

            <button
              type="submit"
              disabled={!canProceed() || isSubmitting}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white transition active:scale-95 disabled:opacity-50 ${
                isLast()
                  ? "flex-[2] bg-green-600 hover:bg-green-700"
                  : "flex-1 bg-primary"
              }`}
            >
              {isSubmitting
                ? "Enviando..."
                : isLast()
                  ? [
                      "Confirmar y registrar",
                      <Check key="icon" size={18} />,
                    ]
                  : [
                      "Siguiente",
                      <ArrowRight key="icon" size={18} />,
                    ]}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;
