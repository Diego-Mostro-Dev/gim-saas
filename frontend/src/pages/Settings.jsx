import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, QrCode, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import toast from "react-hot-toast";

import { useGym } from "../hooks/useGym";
import { updateGym } from "../services/gym.service";
import {
  getSlots,
  createSlot,
  updateSlot,
  deleteSlot,
} from "../services/attendance.service";
import { getCached, isCacheFresh } from "../utils/cache";

function Settings() {
  const navigate = useNavigate();
  const { gym } = useGym();

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    whatsapp: "",
    phone: "",
    email: "",
    default_schedule_capacity: "",
    payment_due_day: "",
    access_block_day: "",
    allow_plan_changes: false,
    allow_schedule_changes: false,
    schedule_change_cooldown_hours: "",
    max_schedule_changes_per_month: "",
    schedule_change_notice_days: "",
  });

  const [errors, setErrors] = useState({});

  function validate() {
    const errs = {};
    const due = Number(formData.payment_due_day);
    const block = Number(formData.access_block_day);
    const cooldown = Number(formData.schedule_change_cooldown_hours);
    const maxChanges = Number(formData.max_schedule_changes_per_month);
    const noticeDays = Number(formData.schedule_change_notice_days);

    if (formData.payment_due_day !== "" && (isNaN(due) || due < 1)) {
      errs.payment_due_day = "Debe ser mayor a 0";
    }
    if (formData.access_block_day !== "" && (isNaN(block) || block < 1)) {
      errs.access_block_day = "Debe ser mayor a 0";
    }
    if (
      formData.payment_due_day !== "" &&
      formData.access_block_day !== "" &&
      block <= due
    ) {
      errs.access_block_day = "Debe ser mayor al día de vencimiento";
    }
    if (formData.schedule_change_cooldown_hours !== "" && (isNaN(cooldown) || cooldown < 0)) {
      errs.schedule_change_cooldown_hours = "No puede ser negativo";
    }
    if (formData.max_schedule_changes_per_month !== "" && (isNaN(maxChanges) || maxChanges < 0)) {
      errs.max_schedule_changes_per_month = "No puede ser negativo";
    }
    if (formData.schedule_change_notice_days !== "" && (isNaN(noticeDays) || noticeDays < 0)) {
      errs.schedule_change_notice_days = "No puede ser negativo";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const [logoFile, setLogoFile] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [slots, setSlots] = useState(() => getCached("slots") || []);
  const [loadingSlots, setLoadingSlots] = useState(() => !isCacheFresh("slots", 10 * 60 * 1000));
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSlot, setNewSlot] = useState({
    day: "monday",
    hour: "08:00",
    capacity: "",
  });
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [editCapacity, setEditCapacity] = useState("");

  const DAY_LABELS = {
    monday: "Lunes",
    tuesday: "Martes",
    wednesday: "Miércoles",
    thursday: "Jueves",
    friday: "Viernes",
    saturday: "Sábado",
  };

  const AVAILABLE_HOURS = [
    "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
    "19:00", "20:00", "21:00",
  ];

  useEffect(() => {
    loadSlots();
  }, []);

  async function loadSlots() {
    if (isCacheFresh("slots", 10 * 60 * 1000)) {
      setSlots(getCached("slots"));
      setLoadingSlots(false);
      try {
        const data = await getSlots();
        setSlots(data);
      } catch {}
      return;
    }
    try {
      setLoadingSlots(true);
      const data = await getSlots();
      setSlots(data);
    } catch {
      toast.error("Error al cargar horarios");
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleCreateSlot(e) {
    e.preventDefault();
    try {
      const data = {
        day: newSlot.day,
        hour: newSlot.hour,
      };
      if (newSlot.capacity !== "") {
        data.capacity = Number(newSlot.capacity);
      }
      await createSlot(data);
      toast.success("Horario creado");
      setShowCreateForm(false);
      setNewSlot({ day: "monday", hour: "08:00", capacity: "" });
      loadSlots();
    } catch (error) {
      toast.error(error.message || "Error al crear horario");
    }
  }

  async function handleUpdateCapacity(id) {
    try {
      const data = {};
      if (editCapacity !== "") {
        data.capacity = Number(editCapacity);
      } else {
        data.capacity = null;
      }
      await updateSlot(id, data);
      toast.success("Capacidad actualizada");
      setEditingSlotId(null);
      loadSlots();
    } catch (error) {
      toast.error(error.message || "Error al actualizar capacidad");
    }
  }

  async function handleDeleteSlot(id) {
    if (!window.confirm("¿Eliminar este horario?")) return;
    try {
      await deleteSlot(id);
      toast.success("Horario eliminado");
      loadSlots();
    } catch (error) {
      toast.error(error.message || "Error al eliminar horario");
    }
  }

  function startEdit(slot) {
    setEditingSlotId(slot.id);
    setEditCapacity(slot.capacity ?? "");
  }

  useEffect(() => {
    if (!gym) return;

    setFormData({
      name: gym.name || "",
      slug: gym.slug || "",
      whatsapp: gym.whatsapp || "",
      phone: gym.phone || "",
      email: gym.email || "",
      default_schedule_capacity:
        gym.default_schedule_capacity ?? "",
      payment_due_day: gym.payment_due_day ?? "",
      access_block_day: gym.access_block_day ?? "",
      allow_plan_changes: gym.allow_plan_changes ?? false,
      allow_schedule_changes: gym.allow_schedule_changes ?? false,
      schedule_change_cooldown_hours: gym.schedule_change_cooldown_hours ?? "",
      max_schedule_changes_per_month: gym.max_schedule_changes_per_month ?? "",
      schedule_change_notice_days: gym.schedule_change_notice_days ?? "",
    });
  }, [gym]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!validate()) return;

    try {
      setIsSubmitting(true);

      const data = new FormData();

      data.append("name", formData.name);
      data.append("slug", formData.slug);
      data.append("whatsapp", formData.whatsapp);
      data.append("phone", formData.phone);
      data.append("email", formData.email);

      if (formData.default_schedule_capacity !== "") {
        data.append(
          "default_schedule_capacity",
          formData.default_schedule_capacity,
        );
      }

      if (formData.payment_due_day !== "") {
        data.append("payment_due_day", formData.payment_due_day);
      }
      if (formData.access_block_day !== "") {
        data.append("access_block_day", formData.access_block_day);
      }
      data.append("allow_plan_changes", formData.allow_plan_changes);
      data.append("allow_schedule_changes", formData.allow_schedule_changes);
      if (formData.schedule_change_cooldown_hours !== "") {
        data.append("schedule_change_cooldown_hours", formData.schedule_change_cooldown_hours);
      }
      if (formData.max_schedule_changes_per_month !== "") {
        data.append("max_schedule_changes_per_month", formData.max_schedule_changes_per_month);
      }
      if (formData.schedule_change_notice_days !== "") {
        data.append("schedule_change_notice_days", formData.schedule_change_notice_days);
      }

      if (logoFile) {
        data.append("logo", logoFile);
      }

      await updateGym(data);

      toast.success("Configuración actualizada correctamente");

      window.location.reload();
    } catch (error) {
      toast.error(error.message || "No se pudo actualizar la configuración");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!gym) {
    return <div className="p-4 text-text-primary">Cargando...</div>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <button
        onClick={() => navigate("/dashboard")}
        className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-primary transition hover:bg-surface-input"
      >
        <ArrowLeft size={18} />
        Volver
      </button>

      <h1 className="mb-2 text-3xl font-bold text-text-primary">Configuración</h1>

      <p className="mb-6 text-text-secondary">Información básica del gimnasio.</p>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-surface-elevated p-6"
      >
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4">
            {logoFile ? (
              <img
                src={URL.createObjectURL(logoFile)}
                alt="Preview"
                className="h-32 w-32 rounded-3xl border border-border/10 object-cover"
              />
            ) : gym.logo_url ? (
              <img
                src={gym.logo_url}
                alt={gym.name}
                className="h-32 w-32 rounded-3xl border border-border/10 object-cover"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-3xl border border-border/10 bg-primary text-5xl font-bold text-white">
                {gym?.name?.charAt(0)?.toUpperCase() || "G"}
              </div>
            )}
          </div>

          <label className="cursor-pointer rounded-xl border border-border/10 px-4 py-2 text-sm text-text-primary transition hover:bg-surface-input">
            Cambiar logo
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-primary">Nombre</label>

          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData({
                ...formData,
                name: e.target.value,
              })
            }
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
            required
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-text-primary">Slug</label>

          <input
            type="text"
            value={formData.slug}
            onChange={(e) =>
              setFormData({
                ...formData,
                slug: e.target.value,
              })
            }
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
            required
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-text-primary">
            WhatsApp
          </label>

          <input
            type="text"
            value={formData.whatsapp}
            onChange={(e) =>
              setFormData({
                ...formData,
                whatsapp: e.target.value,
              })
            }
            placeholder="Ej: 541234567890"
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-text-primary">
            Teléfono
          </label>

          <input
            type="text"
            value={formData.phone}
            onChange={(e) =>
              setFormData({
                ...formData,
                phone: e.target.value,
              })
            }
            placeholder="Ej: 11 2345-6789"
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-text-primary">
            Email
          </label>

          <input
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({
                ...formData,
                email: e.target.value,
              })
            }
            placeholder="Ej: info@gimnasio.com"
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-text-primary">
            Capacidad por defecto por horario
          </label>

          <input
            type="number"
            min="1"
            value={formData.default_schedule_capacity}
            onChange={(e) =>
              setFormData({
                ...formData,
                default_schedule_capacity: e.target.value,
              })
            }
            placeholder="Ej: 20"
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
        </div>

        <hr className="my-6 border-border" />

        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Configuración de Pagos
        </h3>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-primary">
            Día de vencimiento de pago
          </label>
          <input
            type="number"
            min="1"
            value={formData.payment_due_day}
            onChange={(e) => setFormData({ ...formData, payment_due_day: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
          {errors.payment_due_day && (
            <p className="mt-1 text-xs text-danger-text dark:text-danger">{errors.payment_due_day}</p>
          )}
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-text-primary">
            Día de bloqueo de acceso
          </label>
          <input
            type="number"
            min="1"
            value={formData.access_block_day}
            onChange={(e) => setFormData({ ...formData, access_block_day: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
          {errors.access_block_day && (
            <p className="mt-1 text-xs text-danger-text dark:text-danger">{errors.access_block_day}</p>
          )}
        </div>

        <hr className="my-6 border-border" />

        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Configuración de Planes y Horarios
        </h3>

        <div className="mb-4 flex items-center justify-between">
          <label className="text-sm text-text-primary">Permitir cambios de plan</label>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, allow_plan_changes: !formData.allow_plan_changes })}
            className={`relative h-6 w-11 rounded-full transition ${
              formData.allow_plan_changes ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                formData.allow_plan_changes ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <label className="text-sm text-text-primary">Permitir cambios de horario</label>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, allow_schedule_changes: !formData.allow_schedule_changes })}
            className={`relative h-6 w-11 rounded-full transition ${
              formData.allow_schedule_changes ? "bg-primary" : "bg-border"
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                formData.allow_schedule_changes ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-primary">
            Cooldown entre cambios de horario (horas)
          </label>
          <input
            type="number"
            min="0"
            value={formData.schedule_change_cooldown_hours}
            onChange={(e) => setFormData({ ...formData, schedule_change_cooldown_hours: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
          {errors.schedule_change_cooldown_hours && (
            <p className="mt-1 text-xs text-danger-text dark:text-danger">{errors.schedule_change_cooldown_hours}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-primary">
            Máximo de cambios de horario por mes
          </label>
          <input
            type="number"
            min="0"
            value={formData.max_schedule_changes_per_month}
            onChange={(e) => setFormData({ ...formData, max_schedule_changes_per_month: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
          {errors.max_schedule_changes_per_month && (
            <p className="mt-1 text-xs text-danger-text dark:text-danger">{errors.max_schedule_changes_per_month}</p>
          )}
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-text-primary">
            Anticipación requerida para cambios (días)
          </label>
          <input
            type="number"
            min="0"
            value={formData.schedule_change_notice_days}
            onChange={(e) => setFormData({ ...formData, schedule_change_notice_days: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
          {errors.schedule_change_notice_days && (
            <p className="mt-1 text-xs text-danger-text dark:text-danger">{errors.schedule_change_notice_days}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-white transition active:scale-95 disabled:opacity-50"
        >
          {isSubmitting ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <div className="mt-6 space-y-3 rounded-xl border border-border bg-surface-elevated p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Códigos QR
        </h2>

        <button
          onClick={() => navigate("/registration")}
          className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm text-text-primary transition hover:bg-surface-input"
        >
          <QrCode size={18} className="text-primary" />

          <span>Registro de miembros</span>
        </button>

        <button
          onClick={() => navigate("/attendance-qr")}
          className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm text-text-primary transition hover:bg-surface-input"
        >
          <QrCode size={18} className="text-success-text dark:text-success" />

          <span>Asistencia QR</span>
        </button>
      </div>

      {/* Horarios disponibles */}
      <div className="mt-6 rounded-xl border border-border bg-surface-elevated p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Horarios disponibles
          </h2>

          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-white transition active:scale-95"
          >
            <Plus size={14} />
            Agregar
          </button>
        </div>

        {showCreateForm && (
          <form
            onSubmit={handleCreateSlot}
            className="mb-4 rounded-xl border border-border bg-surface-input p-3"
          >
            <div className="mb-3 flex items-center gap-2">
              <select
                value={newSlot.day}
                onChange={(e) =>
                  setNewSlot({ ...newSlot, day: e.target.value })
                }
                className="flex-1 rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none"
              >
                {Object.entries(DAY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={newSlot.hour}
                onChange={(e) =>
                  setNewSlot({ ...newSlot, hour: e.target.value })
                }
                className="rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none"
              >
                {AVAILABLE_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                placeholder="Capacidad"
                value={newSlot.capacity}
                onChange={(e) =>
                  setNewSlot({ ...newSlot, capacity: e.target.value })
                }
                className="w-24 rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-primary transition hover:bg-surface-input"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition active:scale-95"
              >
                Crear
              </button>
            </div>
          </form>
        )}

        {loadingSlots ? (
          <div className="py-4 text-center text-sm text-text-secondary">
            Cargando horarios...
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-xl bg-surface-input px-4 py-3 text-sm text-text-secondary">
            No hay horarios configurados
          </div>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between rounded-xl bg-surface-input px-4 py-3"
              >
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-text-primary">
                    {DAY_LABELS[slot.day]}
                  </span>

                    <span className="text-sm text-text-primary">
                    {slot.hour.slice(0, 5)}
                  </span>

                  {editingSlotId === slot.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        placeholder="Cap."
                        value={editCapacity}
                        onChange={(e) => setEditCapacity(e.target.value)}
                        className="w-16 rounded-lg border border-border bg-surface-input px-2 py-1 text-xs text-text-primary outline-none"
                      />

                      <button
                        onClick={() => handleUpdateCapacity(slot.id)}
                        className="rounded-lg bg-success-bg dark:bg-success/15 p-1 text-success-text dark:text-success transition hover:bg-success/30"
                      >
                        <Check size={14} />
                      </button>

                      <button
                        onClick={() => setEditingSlotId(null)}
                        className="rounded-lg bg-danger-bg dark:bg-danger/15 p-1 text-danger-text dark:text-danger transition hover:bg-danger/30"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-text-secondary">
                      {slot.capacity !== null && slot.capacity !== undefined
                        ? `Cap: ${slot.capacity}`
                        : "(usar capacidad por defecto)"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(slot)}
                    className="rounded-lg bg-info-bg p-1.5 text-info-text dark:bg-info/15 dark:text-info transition hover:bg-info/30"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="rounded-lg bg-danger-bg dark:bg-danger/15 p-1.5 text-danger-text dark:text-danger transition hover:bg-danger/30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
