import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

import { adminGetGym, adminListFeatures, adminUpdateGym } from "../../services/admin.service";
import { Card, Field, Toggle, inputCls } from "./formUi";

function toForm(gym, catalog) {
  const defaults = {};
  for (const feat of catalog) {
    defaults[feat.key] = Boolean(feat.default);
  }
  const features = { ...defaults, ...(gym.features || {}) };

  return {
    name: gym.name || "",
    slug: gym.slug || "",
    active: Boolean(gym.active),
    whatsapp: gym.whatsapp || "",
    phone: gym.phone || "",
    email: gym.email || "",
    payment_due_day: String(gym.payment_due_day ?? ""),
    access_block_day: String(gym.access_block_day ?? ""),
    allow_plan_changes: Boolean(gym.allow_plan_changes),
    allow_schedule_changes: Boolean(gym.allow_schedule_changes),
    schedule_change_cooldown_hours: String(gym.schedule_change_cooldown_hours ?? ""),
    max_schedule_changes_per_month: String(gym.max_schedule_changes_per_month ?? ""),
    allow_session_recovery: Boolean(gym.allow_session_recovery),
    max_session_recoveries_per_month: String(gym.max_session_recoveries_per_month ?? ""),
    default_schedule_capacity:
      gym.default_schedule_capacity == null ? "" : String(gym.default_schedule_capacity),
    seo_title: gym.seo_title || "",
    seo_description: gym.seo_description || "",
    seo_keywords: gym.seo_keywords || "",
    seo_city: gym.seo_city || "",
    seo_address: gym.seo_address || "",
    seo_hours: gym.seo_hours || "",
    qr_attendance_message: gym.qr_attendance_message || "",
    qr_registration_message: gym.qr_registration_message || "",
    features,
  };
}

function buildPayload(form) {
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
  };
  const maybeNum = (v) => num(v, null);

  const payload = {
    name: form.name.trim(),
    active: form.active,
    features: form.features,
  };

  const setIf = (key) => {
    const v = form[key];
    if (v !== null && v !== undefined && v !== "") payload[key] = v;
  };
  setIf("slug");
  setIf("whatsapp");
  setIf("phone");
  setIf("email");
  setIf("seo_title");
  setIf("seo_description");
  setIf("seo_keywords");
  setIf("seo_city");
  setIf("seo_address");
  setIf("seo_hours");
  setIf("qr_attendance_message");
  setIf("qr_registration_message");

  const setNum = (key) => {
    const n = maybeNum(form[key]);
    if (n !== null) payload[key] = n;
  };
  setNum("payment_due_day");
  setNum("access_block_day");
  setNum("schedule_change_cooldown_hours");
  setNum("max_schedule_changes_per_month");
  setNum("max_session_recoveries_per_month");
  setNum("default_schedule_capacity");

  payload.allow_plan_changes = form.allow_plan_changes;
  payload.allow_schedule_changes = form.allow_schedule_changes;
  payload.allow_session_recovery = form.allow_session_recovery;

  return payload;
}

export default function AdminGymEdit() {
  const navigate = useNavigate();
  const { gymId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [gym, features] = await Promise.all([
          adminGetGym(gymId),
          adminListFeatures(),
        ]);
        setCatalog(features.features || []);
        setForm(toForm(gym, features.features || []));
      } catch (error) {
        toast.error(error.message || "No se pudo cargar el gimnasio");
        navigate("/admin");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [gymId, navigate]);

  function set(partial) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("El nombre del gimnasio es obligatorio");
      return;
    }

    try {
      setSaving(true);
      await adminUpdateGym(gymId, buildPayload(form));
      toast.success("Gimnasio actualizado");
      navigate("/admin");
    } catch (error) {
      toast.error(error.message || "No se pudo actualizar el gimnasio");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return (
      <div className="pt-10 text-center text-sm text-text-secondary">Cargando gimnasio...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="rounded-lg p-2 text-text-secondary hover:bg-surface-input hover:text-text-primary"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">{form.name}</h1>
            <p className="text-xs text-text-secondary">Editar gimnasio · /{form.slug}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      <Card title="Features">
        {catalog.length === 0 ? (
          <p className="text-sm text-text-secondary">Catálogo de funcionalidades vacío.</p>
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
      </Card>

      <Card title="Datos y contacto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombre del gimnasio *">
            <input className={inputCls} value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Slug (URL pública)">
            <input className={inputCls} value={form.slug} onChange={(e) => set({ slug: e.target.value })} />
          </Field>
        </div>
        <Toggle
          checked={form.active}
          onChange={(v) => set({ active: v })}
          label="Gimnasio activo"
          hint="Si lo desactivás, inactivás el acceso público del gimnasio."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="WhatsApp">
            <input className={inputCls} value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="+5491112345678" />
          </Field>
          <Field label="Teléfono">
            <input className={inputCls} value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className={inputCls} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card title="Pagos y reglas">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Día de vencimiento">
            <input
              className={inputCls}
              type="number"
              min={1}
              max={31}
              value={form.payment_due_day}
              onChange={(e) => set({ payment_due_day: e.target.value })}
            />
          </Field>
          <Field label="Día de bloqueo" hint="Debe ser posterior al de vencimiento.">
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </Card>

      <Card title="SEO">
        <Field label="Título">
          <input className={inputCls} value={form.seo_title} onChange={(e) => set({ seo_title: e.target.value })} />
        </Field>
        <Field label="Descripción">
          <textarea className={inputCls} rows={2} value={form.seo_description} onChange={(e) => set({ seo_description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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