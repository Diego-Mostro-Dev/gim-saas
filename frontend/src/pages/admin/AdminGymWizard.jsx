import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";

import { adminCreateGym, adminListFeatures } from "../../services/admin.service";
import { DAY_NAMES, DAY_ORDER } from "../../constants/days";
import { Card, Field, Toggle, inputCls, selectCls } from "./formUi";

const STEPS = [
  { id: "datos", title: "Datos" },
  { id: "pagos", title: "Pagos y reglas" },
  { id: "features", title: "Features" },
  { id: "planes", title: "Planes" },
  { id: "actividades", title: "Actividades" },
  { id: "franjas", title: "Franjas" },
  { id: "extras", title: "Extras" },
  { id: "dueno", title: "Dueño y resumen" },
];

const AVAILABLE_HOURS = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
  "19:00", "20:00", "21:00",
];

function slugifyName(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function copyText(text, label) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${label} copiado`))
    .catch(() => toast.error("No se pudo copiar"));
}

const DEFAULT_PLAN = {
  service: "Mensualidad",
  name: "Pase Mensual",
  description: "Acceso ilimitado al gimnasio",
  price: "30000",
  duration_days: "30",
  weekly_visits: "",
  active: true,
};

const DEFAULT_ACTIVITY = {
  service: "Actividades",
  name: "",
  instructor_name: "",
  description: "",
  monthly_price: "0",
  billing_mode: "monthly",
  active: true,
  schedules: [],
};

const DEFAULT_SCHEDULE = {
  day: "monday",
  start_time: "18:00",
  end_time: "19:00",
  capacity: "10",
  active: true,
};

export default function AdminGymWizard() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [featuresCatalog, setFeaturesCatalog] = useState([]);
  const [form, setForm] = useState(initialForm());
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    adminListFeatures()
      .then((data) => {
        setFeaturesCatalog(data.features || []);
        setForm((prev) => {
          if (Object.keys(prev.features).length > 0) return prev;
          const defaults = {};
          for (const f of data.features || []) {
            defaults[f.key] = Boolean(f.default);
          }
          return { ...prev, features: defaults };
        });
      })
      .catch((error) => {
        toast.error(error.message || "No se pudieron cargar las features");
      });
  }, []);

  function set(partial) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function setList(key, updater) {
    setForm((prev) => ({ ...prev, [key]: updater(prev[key]) }));
  }

  const activitiesOn = Boolean(form.features.activities);

  if (created) {
    return <SuccessView gym={created} onReset={() => navigate("/admin")} />;
  }

  const current = STEPS[stepIndex];

  function canAdvance() {
    if (current.id === "datos") {
      if (!form.name.trim()) {
        toast.error("Indicá el nombre del gimnasio");
        return false;
      }
    }
    if (current.id === "dueno") {
      return validateOwnerStep();
    }
    return true;
  }

  function validateOwnerStep() {
    const owner = form.owner;
    if (owner.mode === "credentials") {
      if (!owner.username.trim()) {
        toast.error("El usuario del dueño es obligatorio");
        return false;
      }
      if (!owner.password) {
        toast.error("La contraseña es obligatoria");
        return false;
      }
      if (owner.password.length < 8) {
        toast.error("La contraseña debe tener al menos 8 caracteres");
        return false;
      }
      if (owner.password !== owner.confirm) {
        toast.error("Las contraseñas no coinciden");
        return false;
      }
    }
    for (const a of form.activities) {
      if (a.billing_mode === "sessions" && a.schedules.length === 0) {
        toast.error(`La actividad "${a.name || "sin nombre"}" por sesiones necesita horarios`);
        return false;
      }
    }
    return true;
  }

  async function handleSubmit() {
    const payload = buildPayload(form);

    try {
      setSubmitting(true);
      const gym = await adminCreateGym(payload);
      setCreated(gym);
      toast.success("Gimnasio creado");
    } catch (error) {
      toast.error(error.message || "No se pudo crear el gimnasio");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="rounded-lg p-2 text-text-secondary hover:bg-surface-input hover:text-text-primary"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">Nuevo gimnasio</h1>
      </div>

      <Stepper steps={STEPS} current={stepIndex} />

      <div className="rounded-xl border border-border bg-surface-elevated p-4">
        {current.id === "datos" && <DatosStep form={form} set={set} />}
        {current.id === "pagos" && <PagosStep form={form} set={set} />}
        {current.id === "features" && (
          <FeaturesStep
            catalog={featuresCatalog}
            form={form}
            set={set}
          />
        )}
        {current.id === "planes" && <PlanesStep form={form} setList={setList} />}
        {current.id === "actividades" && (
          <ActividadesStep form={form} setList={setList} enabled={activitiesOn} />
        )}
        {current.id === "franjas" && <FranjasStep form={form} setList={setList} />}
        {current.id === "extras" && <ExtrasStep form={form} set={set} setList={setList} />}
        {current.id === "dueno" && <OwnerStep form={form} set={set} />}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          disabled={stepIndex === 0}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-text-primary hover:bg-surface-input disabled:opacity-40"
        >
          <ArrowLeft size={16} />
          Anterior
        </button>

        {stepIndex < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => {
              if (canAdvance()) setStepIndex((i) => i + 1);
            }}
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Siguiente
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            <Check size={16} />
            {submitting ? "Creando..." : "Crear gimnasio"}
          </button>
        )}
      </div>
    </div>
  );
}

function initialForm() {
  return {
    name: "",
    slug: "",
    active: true,
    whatsapp: "",
    phone: "",
    email: "",
    qr_attendance_message: "",
    qr_registration_message: "",
    default_schedule_capacity: "",
    payment_due_day: "10",
    access_block_day: "16",
    allow_plan_changes: true,
    allow_schedule_changes: true,
    schedule_change_cooldown_hours: "168",
    max_schedule_changes_per_month: "4",
    allow_session_recovery: false,
    max_session_recoveries_per_month: "2",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    seo_city: "",
    seo_address: "",
    seo_hours: "",
    features: {},
    services: [],
    plans: [DEFAULT_PLAN],
    activities: [],
    slots: [],
    discounts: [],
    health_insurances: [],
    closed_dates: [],
    owner: { mode: "link", username: "", email: "", password: "", confirm: "" },
  };
}

function buildPayload(form) {
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
  };

  return {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    active: form.active,
    whatsapp: form.whatsapp.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    qr_attendance_message: form.qr_attendance_message.trim(),
    qr_registration_message: form.qr_registration_message.trim(),
    default_schedule_capacity:
      form.default_schedule_capacity === ""
        ? undefined
        : num(form.default_schedule_capacity, undefined),
    payment_due_day: num(form.payment_due_day, 10),
    access_block_day: num(form.access_block_day, 16),
    allow_plan_changes: form.allow_plan_changes,
    allow_schedule_changes: form.allow_schedule_changes,
    schedule_change_cooldown_hours: num(form.schedule_change_cooldown_hours, 168),
    max_schedule_changes_per_month: num(form.max_schedule_changes_per_month, 4),
    allow_session_recovery: form.allow_session_recovery,
    max_session_recoveries_per_month: num(form.max_session_recoveries_per_month, 2),
    seo_title: form.seo_title.trim(),
    seo_description: form.seo_description.trim(),
    seo_keywords: form.seo_keywords.trim(),
    seo_city: form.seo_city.trim(),
    seo_address: form.seo_address.trim(),
    seo_hours: form.seo_hours.trim(),
    features: form.features,
    services: form.services.map((s) => ({
      name: s.name.trim(),
      description: s.description || "",
      active: s.active,
    })),
    plans: form.plans.map((p) => ({
      service: p.service.trim() || "Mensualidad",
      name: p.name.trim(),
      description: p.description || "",
      price: String(p.price),
      duration_days: num(p.duration_days, 30),
      weekly_visits:
        p.weekly_visits === "" || p.weekly_visits === null
          ? null
          : num(p.weekly_visits, null),
      active: p.active,
    })),
    slots: form.slots.map((s) => ({
      day: s.day,
      hour: s.hour,
      capacity: s.capacity === "" ? undefined : num(s.capacity, undefined),
    })),
    activities: form.features.activities
      ? form.activities.map((a) => ({
          service: a.service.trim() || "Actividades",
          name: a.name.trim(),
          description: a.description || "",
          instructor_name: a.instructor_name || "",
          monthly_price: String(a.monthly_price),
          billing_mode: a.billing_mode,
          active: a.active,
          schedules: a.schedules.map((sch) => ({
            day: sch.day,
            start_time: sch.start_time,
            end_time: sch.end_time,
            capacity: num(sch.capacity, 10),
            active: sch.active,
          })),
        }))
      : [],
    discounts: form.discounts.map((d) => ({
      name: d.name.trim(),
      discount_percent: num(d.discount_percent, 0),
      active: d.active,
    })),
    health_insurances: form.health_insurances.map((h) => ({
      name: h.name.trim(),
      session_price: String(h.session_price === "" ? 0 : h.session_price),
      sellado_amount:
        h.sellado_amount === "" ? null : String(h.sellado_amount),
      active: h.active,
    })),
    closed_dates: form.closed_dates.map((c) => ({
      date: c.date,
      reason: c.reason || "",
    })),
    owner:
      form.owner.mode === "credentials"
        ? {
            mode: "credentials",
            username: form.owner.username.trim(),
            email: form.owner.email.trim(),
            password: form.owner.password,
          }
        : { mode: "link" },
  };
}

function Stepper({ steps, current }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const active = i === current;
        const visited = i < current;
        return (
          <div key={step.id} className="flex items-center gap-1">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? "bg-primary text-white"
                  : visited
                    ? "bg-info/20 text-info"
                    : "bg-surface-input text-text-secondary"
              }`}
            >
              {visited ? <Check size={14} /> : i + 1}
            </span>
            <span
              className={`whitespace-nowrap text-xs ${
                active ? "font-medium text-text-primary" : "text-text-secondary"
              }`}
            >
              {step.title}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 h-px w-2 bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pasos
// ---------------------------------------------------------------------------

function DatosStep({ form, set }) {
  return (
    <div className="space-y-4">
      <Card title="Identidad">
        <Field label="Nombre del gimnasio *">
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              set({
                name,
                slug: form.slug === "" ? slugifyName(name) : form.slug,
              });
            }}
            placeholder="Ej: SportBox Palermo"
          />
        </Field>
        <Field label="Slug (URL pública)" hint="Si lo dejás vacío se genera solo.">
          <input
            className={inputCls}
            value={form.slug}
            onChange={(e) => set({ slug: e.target.value })}
            placeholder="sportbox-palermo"
          />
        </Field>
        <Toggle
          checked={form.active}
          onChange={(v) => set({ active: v })}
          label="Activo desde el inicio"
        />
      </Card>

      <Card title="Contacto">
        <Field label="WhatsApp">
          <input className={inputCls} value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="+5491112345678" />
        </Field>
        <Field label="Teléfono">
          <input className={inputCls} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputCls} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
      </Card>
    </div>
  );
}

function PagosStep({ form, set }) {
  return (
    <div className="space-y-4">
      <Card title="Días de corte">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Día de vencimiento" hint="Cobro mensual">
            <input
              className={inputCls}
              type="number"
              min={1}
              max={31}
              value={form.payment_due_day}
              onChange={(e) => set({ payment_due_day: e.target.value })}
            />
          </Field>
          <Field label="Día de bloqueo" hint="Se corta el acceso" >
            <input
              className={inputCls}
              type="number"
              min={1}
              max={31}
              value={form.access_block_day}
              onChange={(e) => set({ access_block_day: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card title="Cambios de planes y horarios">
        <Toggle
          checked={form.allow_plan_changes}
          onChange={(v) => set({ allow_plan_changes: v })}
          label="Permitir cambio de plan"
        />
        <Toggle
          checked={form.allow_schedule_changes}
          onChange={(v) => set({ allow_schedule_changes: v })}
          label="Permitir cambio de horario en el portal"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cooldown entre cambios (horas)">
            <input
              className={inputCls}
              type="number"
              min={0}
              value={form.schedule_change_cooldown_hours}
              onChange={(e) => set({ schedule_change_cooldown_hours: e.target.value })}
            />
          </Field>
          <Field label="Cambios máximos por mes">
            <input
              className={inputCls}
              type="number"
              min={0}
              value={form.max_schedule_changes_per_month}
              onChange={(e) => set({ max_schedule_changes_per_month: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card title="Recuperación de sesiones">
        <Toggle
          checked={form.allow_session_recovery}
          onChange={(v) => set({ allow_session_recovery: v })}
          label="Permitir recuperar sesiones perdidas"
        />
        {form.allow_session_recovery && (
          <Field label="Recuperaciones máximas por mes">
            <input
              className={inputCls}
              type="number"
              min={0}
              value={form.max_session_recoveries_per_month}
              onChange={(e) => set({ max_session_recoveries_per_month: e.target.value })}
            />
          </Field>
        )}
      </Card>

      <Card title="Capacidad por defecto">
        <Field label="Capacidad default de los horarios" hint="Dejalo vacío si no aplica.">
          <input
            className={inputCls}
            type="number"
            min={1}
            value={form.default_schedule_capacity}
            onChange={(e) => set({ default_schedule_capacity: e.target.value })}
          />
        </Field>
      </Card>
    </div>
  );
}

function FeaturesStep({ catalog, form, set }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-text-primary">
        Funcionalidades del gimnasio
      </p>
      {catalog.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Cargando catálogo...
        </p>
      ) : (
        catalog.map((feat) => (
          <div
            key={feat.key}
            className={`rounded-xl border p-4 ${
              form.features[feat.key]
                ? "border-info bg-info-bg"
                : "border-border bg-surface-input"
            }`}
          >
            <Toggle
              checked={Boolean(form.features[feat.key])}
              onChange={(v) =>
                set({ features: { ...form.features, [feat.key]: v } })
              }
              label={feat.label}
              hint={feat.description}
            />
          </div>
        ))
      )}
    </div>
  );
}

function PlanesStep({ form, setList }) {
  function updatePlan(i, patch) {
    setList("plans", (plans) =>
      plans.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    );
  }

  function removePlan(i) {
    setList("plans", (plans) => plans.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      <Card title="Servicios del gimnasio">
        <p className="text-xs text-text-secondary">
          El servicio base "Gimnasio" se crea solo. Agregá servicios extra
          (ej: "Mensualidad", "Yoga") si querés agrupar planes.
        </p>
        {form.services.length === 0 && (
          <p className="text-xs text-text-secondary">Sin servicios extra.</p>
        )}
        <div className="space-y-2">
          {form.services.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={inputCls}
                value={s.name}
                onChange={(e) =>
                  setList("services", (svs) =>
                    svs.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x))
                  )
                }
                placeholder="Nombre del servicio"
              />
              <button
                type="button"
                onClick={() =>
                  setList("services", (svs) => svs.filter((_, idx) => idx !== i))
                }
                className="rounded-lg border border-border p-2 text-text-secondary hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setList("services", (svs) => [
              ...svs,
              { name: "", description: "", active: true },
            ])
          }
          className="flex items-center gap-1 text-sm text-info hover:underline"
        >
          <Plus size={16} />
          Agregar servicio
        </button>
      </Card>

      <Card title="Planes">
        <div className="space-y-3">
          {form.plans.map((plan, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-text-secondary">
                  Plan {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removePlan(i)}
                  className="rounded p-1 text-text-secondary hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Nombre *">
                  <input
                    className={inputCls}
                    value={plan.name}
                    onChange={(e) => updatePlan(i, { name: e.target.value })}
                  />
                </Field>
                <Field label="Servicio">
                  <input
                    className={inputCls}
                    value={plan.service}
                    onChange={(e) => updatePlan(i, { service: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Descripción">
                <input
                  className={inputCls}
                  value={plan.description}
                  onChange={(e) => updatePlan(i, { description: e.target.value })}
                />
              </Field>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Precio">
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={plan.price}
                    onChange={(e) => updatePlan(i, { price: e.target.value })}
                  />
                </Field>
                <Field label="Duración (días)">
                  <input
                    className={inputCls}
                    type="number"
                    min={1}
                    value={plan.duration_days}
                    onChange={(e) => updatePlan(i, { duration_days: e.target.value })}
                  />
                </Field>
                <Field label="Visitas semanales">
                  <input
                    className={inputCls}
                    type="number"
                    min={1}
                    value={plan.weekly_visits}
                    placeholder="Ilimitado"
                    onChange={(e) => updatePlan(i, { weekly_visits: e.target.value })}
                  />
                </Field>
                <div className="flex items-end">
                  <Toggle
                    checked={plan.active}
                    onChange={(v) => updatePlan(i, { active: v })}
                    label="Activo"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setList("plans", (plans) => [
              ...plans,
              { ...DEFAULT_PLAN, name: "", price: "0" },
            ])
          }
          className="flex items-center gap-1 text-sm text-info hover:underline"
        >
          <Plus size={16} />
          Agregar plan
        </button>
      </Card>
    </div>
  );
}

function ActividadesStep({ form, setList, enabled }) {
  if (!enabled) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-text-secondary">
          Activá la feature "Actividades" en Features para configurarlas.
        </p>
      </div>
    );
  }

  function updateActivity(i, patch) {
    setList("activities", (acts) =>
      acts.map((a, idx) => (idx === i ? { ...a, ...patch } : a))
    );
  }

  function addSchedule(activityIdx, schedule) {
    setList("activities", (acts) =>
      acts.map((a, idx) =>
        idx === activityIdx
          ? { ...a, schedules: [...a.schedules, schedule] }
          : a
      )
    );
  }

  function removeSchedule(activityIdx, schedIdx) {
    setList("activities", (acts) =>
      acts.map((a, idx) =>
        idx === activityIdx
          ? { ...a, schedules: a.schedules.filter((_, si) => si !== schedIdx) }
          : a
      )
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-text-primary">Actividades</p>
      {form.activities.length === 0 && (
        <p className="text-sm text-text-secondary">
          No hay actividades cargadas todavía.
        </p>
      )}

      {form.activities.map((act, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-text-secondary">
              Actividad {i + 1}
            </span>
            <button
              type="button"
              onClick={() =>
                setList("activities", (acts) => acts.filter((_, idx) => idx !== i))
              }
              className="rounded p-1 text-text-secondary hover:text-danger"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Nombre *">
              <input
                className={inputCls}
                value={act.name}
                onChange={(e) => updateActivity(i, { name: e.target.value })}
              />
            </Field>
            <Field label="Profesor">
              <input
                className={inputCls}
                value={act.instructor_name}
                onChange={(e) => updateActivity(i, { instructor_name: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Descripción">
            <input
              className={inputCls}
              value={act.description}
              onChange={(e) => updateActivity(i, { description: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Precio mensual">
              <input
                className={inputCls}
                type="number"
                min={0}
                value={act.monthly_price}
                onChange={(e) => updateActivity(i, { monthly_price: e.target.value })}
              />
            </Field>
            <Field label="Pago">
              <select
                className={selectCls}
                value={act.billing_mode}
                onChange={(e) => updateActivity(i, { billing_mode: e.target.value })}
              >
                <option value="monthly">Mensual</option>
                <option value="sessions">Por sesión</option>
              </select>
            </Field>
            <div className="flex items-end">
              <Toggle
                checked={act.active}
                onChange={(v) => updateActivity(i, { active: v })}
                label="Activa"
              />
            </div>
          </div>

          <div className="border-t border-border pt-2">
            <p className="mb-2 text-xs font-medium text-text-secondary">
              Horarios ({act.schedules.length})
            </p>
            <div className="space-y-2">
              {act.schedules.map((sch, si) => (
                <div key={si} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-input p-2">
                  <select
                    className={selectCls}
                    value={sch.day}
                    onChange={(e) =>
                      updateActivity(i, {
                        schedules: act.schedules.map((s, idx) =>
                          idx === si ? { ...s, day: e.target.value } : s
                        ),
                      })
                    }
                  >
                    {DAY_ORDER.map((day) => (
                      <option key={day} value={day}>
                        {DAY_NAMES[day]}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectCls}
                    value={sch.start_time}
                    onChange={(e) =>
                      updateActivity(i, {
                        schedules: act.schedules.map((s, idx) =>
                          idx === si
                            ? { ...s, start_time: e.target.value, end_time: nextHour(e.target.value) }
                            : s
                        ),
                      })
                    }
                  >
                    {AVAILABLE_HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-text-secondary">a</span>
                  <select
                    className={selectCls}
                    value={sch.end_time}
                    onChange={(e) =>
                      updateActivity(i, {
                        schedules: act.schedules.map((s, idx) =>
                          idx === si ? { ...s, end_time: e.target.value } : s
                        ),
                      })
                    }
                  >
                    {AVAILABLE_HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${inputCls} w-20`}
                    type="number"
                    min={1}
                    value={sch.capacity}
                    onChange={(e) =>
                      updateActivity(i, {
                        schedules: act.schedules.map((s, idx) =>
                          idx === si ? { ...s, capacity: e.target.value } : s
                        ),
                      })
                    }
                    placeholder="Cupo"
                  />
                  <button
                    type="button"
                    onClick={() => removeSchedule(i, si)}
                    className="rounded p-1 text-text-secondary hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => addSchedule(i, { ...DEFAULT_SCHEDULE })}
              className="mt-2 flex items-center gap-1 text-sm text-info hover:underline"
            >
              <Plus size={16} />
              Agregar horario
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setList("activities", (acts) => [
            ...acts,
            { ...DEFAULT_ACTIVITY },
          ])
        }
        className="flex items-center gap-1 text-sm text-info hover:underline"
      >
        <Plus size={16} />
        Agregar actividad
      </button>
    </div>
  );
}

function nextHour(hour) {
  const [h, m] = hour.split(":").map(Number);
  return `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function FranjasStep({ form, setList }) {
  const [newSlot, setNewSlot] = useState({
    day: "monday",
    hour: "08:00",
    capacity: "",
  });
  const [batch, setBatch] = useState({
    days: [],
    start_time: "08:00",
    end_time: "20:00",
    step_minutes: 60,
    capacity: "",
  });

  function handleAdd() {
    if (form.slots.some((s) => s.day === newSlot.day && s.hour === newSlot.hour)) {
      toast.error("Esa franja ya existe");
      return;
    }
    setList("slots", (slots) => [...slots, newSlot]);
  }

  function handleRemove(i) {
    setList("slots", (slots) => slots.filter((_, idx) => idx !== i));
  }

  function handleBulk() {
    if (batch.days.length === 0) {
      toast.error("Elegí al menos un día");
      return;
    }
    const generated = [];
    let [sh, sm] = batch.start_time.split(":").map(Number);
    const [eh, em] = batch.end_time.split(":").map(Number);
    const step = Number(batch.step_minutes) || 60;
    let current = sh * 60 + sm;
    const end = eh * 60 + em;
    while (current < end) {
      const hour = `${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`;
      for (const day of batch.days) {
        generated.push({ day, hour, capacity: batch.capacity });
      }
      current += step;
    }
    if (generated.length === 0) {
      toast.error("No se generaron franjas");
      return;
    }
    setList("slots", (slots) => {
      const existing = new Set(slots.map((s) => `${s.day}|${s.hour}`));
      const fresh = generated.filter((g) => !existing.has(`${g.day}|${g.hour}`));
      return [...slots, ...fresh];
    });
    toast.success(`Se generaron ${generated.length} franjas`);
  }

  function toggleBatchDay(day) {
    setBatch((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }));
  }

  return (
    <div className="space-y-4">
      <Card title="Agregar una franja">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Día">
            <select
              className={selectCls}
              value={newSlot.day}
              onChange={(e) => setNewSlot({ ...newSlot, day: e.target.value })}
            >
              {DAY_ORDER.map((day) => (
                <option key={day} value={day}>
                  {DAY_NAMES[day]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Horario">
            <select
              className={selectCls}
              value={newSlot.hour}
              onChange={(e) => setNewSlot({ ...newSlot, hour: e.target.value })}
            >
              {AVAILABLE_HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Capacidad">
            <input
              className={`${inputCls} w-24`}
              type="number"
              min={1}
              value={newSlot.capacity}
              onChange={(e) => setNewSlot({ ...newSlot, capacity: e.target.value })}
              placeholder="S/ limite"
            />
          </Field>
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            <Plus size={16} />
            Agregar
          </button>
        </div>
      </Card>

      <Card title="Generar semana entera">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-wrap gap-1">
            {DAY_ORDER.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleBatchDay(day)}
                className={`rounded-lg px-2 py-1 text-xs ${
                  batch.days.includes(day)
                    ? "bg-primary text-white"
                    : "border border-border bg-surface-input text-text-secondary"
                }`}
              >
                {DAY_NAMES[day].slice(0, 3)}
              </button>
            ))}
          </div>
          <select
            className={selectCls}
            value={batch.start_time}
            onChange={(e) => setBatch({ ...batch, start_time: e.target.value })}
          >
            {AVAILABLE_HOURS.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <span className="text-xs text-text-secondary">a</span>
          <select
            className={selectCls}
            value={batch.end_time}
            onChange={(e) => setBatch({ ...batch, end_time: e.target.value })}
          >
            {AVAILABLE_HOURS.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <select
            className={selectCls}
            value={batch.step_minutes}
            onChange={(e) => setBatch({ ...batch, step_minutes: e.target.value })}
          >
            <option value="60">cada 1 h</option>
            <option value="30">cada 30 min</option>
            <option value="120">cada 2 h</option>
          </select>
          <input
            className={`${inputCls} w-24`}
            type="number"
            min={1}
            value={batch.capacity}
            placeholder="Capacidad"
            onChange={(e) => setBatch({ ...batch, capacity: e.target.value })}
          />
          <button
            type="button"
            onClick={handleBulk}
            className="rounded-lg border border-border px-3 py-2 text-sm text-text-primary hover:bg-surface-input"
          >
            Generar
          </button>
        </div>
      </Card>

      <Card title={`Franjas cargadas (${form.slots.length})`}>
        {form.slots.length === 0 ? (
          <p className="text-sm text-text-secondary">Sin franjas todavía.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[...form.slots]
              .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
              .map((s, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 rounded-lg border border-border bg-surface-input px-2 py-1 text-xs text-text-primary"
                >
                  {DAY_NAMES[s.day]} {s.hour}
                  {s.capacity ? ` · ${s.capacity}` : ""}
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    className="text-text-secondary hover:text-danger"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ExtrasStep({ form, set, setList }) {
  const [discount, setDiscount] = useState({ name: "", discount_percent: "", active: true });
  const [insurance, setInsurance] = useState({
    name: "",
    session_price: "",
    sellado_amount: "",
    active: true,
  });
  const [closed, setClosed] = useState({ date: "", reason: "" });

  return (
    <div className="space-y-4">
      <Card title="Descuentos">
        <div className="space-y-2">
          {form.discounts.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary">
                {d.name}
              </span>
              <span className="w-16 rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary">
                {d.discount_percent}%
              </span>
              <button
                type="button"
                onClick={() =>
                  setList("discounts", (ds) => ds.filter((_, idx) => idx !== i))
                }
                className="rounded p-1 text-text-secondary hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Nombre">
            <input
              className={inputCls}
              value={discount.name}
              onChange={(e) => setDiscount({ ...discount, name: e.target.value })}
            />
          </Field>
          <Field label="Porcentaje">
            <input
              className={`${inputCls} w-24`}
              type="number"
              min={1}
              max={100}
              value={discount.discount_percent}
              onChange={(e) =>
                setDiscount({ ...discount, discount_percent: e.target.value })
              }
            />
          </Field>
          <button
            type="button"
            onClick={() => {
              const percent = Number(discount.discount_percent);
              if (!discount.name.trim()) {
                toast.error("El descuento necesita nombre");
                return;
              }
              if (!percent || percent < 1 || percent > 100) {
                toast.error("El porcentaje debe estar entre 1 y 100");
                return;
              }
              setList("discounts", (ds) => [
                ...ds,
                { ...discount, name: discount.name.trim() },
              ]);
              setDiscount({ name: "", discount_percent: "", active: true });
            }}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            <Plus size={16} />
            Agregar
          </button>
        </div>
      </Card>

      <Card title="Obras sociales">
        <div className="space-y-2">
          {form.health_insurances.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex-1 rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary">
                {h.name}
              </span>
              <span className="w-24 rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary">
                coseguro ${h.session_price}
              </span>
              <button
                type="button"
                onClick={() =>
                  setList("health_insurances", (hs) => hs.filter((_, idx) => idx !== i))
                }
                className="rounded p-1 text-text-secondary hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Nombre">
            <input
              className={inputCls}
              value={insurance.name}
              onChange={(e) => setInsurance({ ...insurance, name: e.target.value })}
            />
          </Field>
          <Field label="Coseguro por sesión">
            <input
              className={`${inputCls} w-32`}
              type="number"
              min={0}
              value={insurance.session_price}
              onChange={(e) =>
                setInsurance({ ...insurance, session_price: e.target.value })
              }
            />
          </Field>
          <Field label="Sellado">
            <input
              className={`${inputCls} w-24`}
              type="number"
              min={0}
              value={insurance.sellado_amount}
              onChange={(e) =>
                setInsurance({ ...insurance, sellado_amount: e.target.value })
              }
            />
          </Field>
          <button
            type="button"
            onClick={() => {
              if (!insurance.name.trim()) {
                toast.error("La obra social necesita nombre");
                return;
              }
              setList("health_insurances", (hs) => [...hs, insurance]);
              setInsurance({ name: "", session_price: "", sellado_amount: "", active: true });
            }}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            <Plus size={16} />
            Agregar
          </button>
        </div>
      </Card>

      <Card title="Fechas cerradas">
        {form.closed_dates.length > 0 && (
          <div className="space-y-2">
            {form.closed_dates.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex-1 rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary">
                  {c.date} {c.reason ? `· ${c.reason}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setList("closed_dates", (cds) => cds.filter((_, idx) => idx !== i))
                  }
                  className="rounded p-1 text-text-secondary hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Fecha">
            <input
              className={inputCls}
              type="date"
              value={closed.date}
              onChange={(e) => setClosed({ ...closed, date: e.target.value })}
            />
          </Field>
          <Field label="Motivo">
            <input
              className={inputCls}
              value={closed.reason}
              onChange={(e) => setClosed({ ...closed, reason: e.target.value })}
            />
          </Field>
          <button
            type="button"
            onClick={() => {
              if (!closed.date) {
                toast.error("Elegí una fecha");
                return;
              }
              setList("closed_dates", (cds) => [...cds, closed]);
              setClosed({ date: "", reason: "" });
            }}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            <Plus size={16} />
            Agregar
          </button>
        </div>
      </Card>

      <Card title="SEO">
        <Field label="Título">
          <input className={inputCls} value={form.seo_title} onChange={(e) => set({ seo_title: e.target.value })} />
        </Field>
        <Field label="Descripción">
          <textarea className={inputCls} rows={2} value={form.seo_description} onChange={(e) => set({ seo_description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Palabras clave">
            <input className={inputCls} value={form.seo_keywords} onChange={(e) => set({ seo_keywords: e.target.value })} />
          </Field>
          <Field label="Ciudad">
            <input className={inputCls} value={form.seo_city} onChange={(e) => set({ seo_city: e.target.value })} />
          </Field>
        </div>
        <Field label="Dirección">
          <input className={inputCls} value={form.seo_address} onChange={(e) => set({ seo_address: e.target.value })} />
        </Field>
        <Field label="Horarios (texto libre)">
          <input className={inputCls} value={form.seo_hours} onChange={(e) => set({ seo_hours: e.target.value })} />
        </Field>
      </Card>

      <Card title="Mensajes QR">
        <Field label="Mensaje al marcar asistencia">
          <input className={inputCls} value={form.qr_attendance_message} onChange={(e) => set({ qr_attendance_message: e.target.value })} />
        </Field>
        <Field label="Mensaje al registrarse con QR">
          <input className={inputCls} value={form.qr_registration_message} onChange={(e) => set({ qr_registration_message: e.target.value })} />
        </Field>
      </Card>
    </div>
  );
}

function OwnerStep({ form, set }) {
  const owner = form.owner;

  return (
    <div className="space-y-4">
      <Card title="Acceso del dueño">
        <Toggle
          checked={owner.mode === "link"}
          onChange={(v) => set({ owner: { ...owner, mode: v ? "link" : "credentials" } })}
          label="Link de onboarding (recomendado)"
          hint="Se le envía el link al dueño, que completa sus datos y pone su contraseña."
        />
        <Toggle
          checked={owner.mode === "credentials"}
          onChange={(v) => set({ owner: { ...owner, mode: v ? "credentials" : "link" } })}
          label="Crear credenciales yo mismo"
          hint="Vos definís el usuario y una clave provisoria que el dueño debería cambiar al entrar."
        />

        {owner.mode === "credentials" && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <Field label="Usuario *">
              <input
                className={inputCls}
                value={owner.username}
                onChange={(e) => set({ owner: { ...owner, username: e.target.value } })}
              />
            </Field>
            <Field label="Email">
              <input
                className={inputCls}
                type="email"
                value={owner.email}
                onChange={(e) => set({ owner: { ...owner, email: e.target.value } })}
              />
            </Field>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Contraseña *" hint="Mínimo 8 caracteres.">
                <input
                  className={inputCls}
                  type="password"
                  value={owner.password}
                  onChange={(e) => set({ owner: { ...owner, password: e.target.value } })}
                />
              </Field>
              <Field label="Repetir contraseña *">
                <input
                  className={inputCls}
                  type="password"
                  value={owner.confirm}
                  onChange={(e) => set({ owner: { ...owner, confirm: e.target.value } })}
                />
              </Field>
            </div>
          </div>
        )}
      </Card>

      <Resumen form={form} />
    </div>
  );
}

function Resumen({ form }) {
  const activitiesCount = form.features.activities ? form.activities.length : 0;

  return (
    <Card title="Resumen">
      <Row label="Gimnasio" value={form.name || "—"} />
      <Row label="Slug" value={`/${form.slug || slugifyName(form.name) || "…"}`} />
      <Row
        label="Planes"
        value={`${form.plans.length} (${form.plans
          .map((p) => p.name || "sin nombre")
          .join(", ") || "—"})`}
      />
      <Row label="Actividades" value={form.features.activities ? `${activitiesCount}` : "Feature apagada"} />
      <Row label="Franjas de horario" value={`${form.slots.length}`} />
      <Row label="Descuentos" value={`${form.discounts.length}`} />
      <Row label="Obras sociales" value={`${form.health_insurances.length}`} />
      <Row label="Fechas cerradas" value={`${form.closed_dates.length}`} />
      <Row
        label="Dueño"
        value={form.owner.mode === "link" ? "Link de onboarding" : `Credenciales para ${form.owner.username || "…"}`}
      />
    </Card>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="ml-4 text-right font-medium text-text-primary">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Éxito
// ---------------------------------------------------------------------------

function SuccessView({ gym, onReset }) {
  const canCreateOwner = !gym.owner_created;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-success/40 bg-success/10 p-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success text-white">
          <Check size={24} />
        </span>
        <h2 className="text-lg font-semibold text-text-primary">
          {gym.name} fue creado
        </h2>
        <p className="text-sm text-text-secondary">
          Link de registro público y de onboarding listos para compartir.
        </p>
      </div>

      <Card title="Links del gimnasio">
        {canCreateOwner && (
          <div>
            <p className="mb-1 text-xs font-medium text-text-secondary">
              Link para el dueño (onboarding)
            </p>
            <div className="flex items-center gap-2">
              <input readOnly className={inputCls} value={gym.onboarding_url} />
              <button
                type="button"
                onClick={() => copyText(gym.onboarding_url, "Link de onboarding")}
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-text-primary hover:bg-surface-input"
              >
                <Copy size={16} />
                Copiar
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-medium text-text-secondary">
            Link público de registro (socios)
          </p>
          <div className="flex items-center gap-2">
            <input readOnly className={inputCls} value={gym.register_url} />
            <button
              type="button"
              onClick={() => copyText(gym.register_url, "Link de registro")}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-text-primary hover:bg-surface-input"
            >
              <Copy size={16} />
              Copiar
            </button>
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onReset}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          Volver al panel
        </button>
      </div>
    </div>
  );
}