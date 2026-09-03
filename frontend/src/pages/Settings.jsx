import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, QrCode, Plus, Pencil, Trash2, X, Check, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

import { useGym } from "../hooks/useGym";
import useAuthStore from "../store/auth.store";
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
  const role = useAuthStore((state) => state.role);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    whatsapp: "",
    phone: "",
    email: "",
    default_schedule_capacity: "",
    payment_due_day: "",
    access_block_day: "",
    allow_plan_changes: false,
    allow_schedule_changes: false,
    schedule_change_cooldown_days: "",
    max_schedule_changes_per_month: "",
    schedule_change_notice_days: "",
    qr_attendance_message: "",
    qr_registration_message: "",
    seo_title: "",
    seo_description: "",
    seo_keywords: "",
    seo_city: "",
    seo_address: "",
    seo_hours: "",
  });

  const [errors, setErrors] = useState({});

  function validate() {
    const errs = {};
    const due = Number(formData.payment_due_day);
    const block = Number(formData.access_block_day);
    const cooldown = Number(formData.schedule_change_cooldown_days);
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
    if (formData.schedule_change_cooldown_days !== "" && (isNaN(cooldown) || cooldown < 0)) {
      errs.schedule_change_cooldown_days = "No puede ser negativo";
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
  const [iconFile, setIconFile] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState("info");

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

  const TABS = [
    { id: "info", label: "Información" },
    { id: "pagos", label: "Pagos" },
    { id: "planes", label: "Planes & Horarios" },
    { id: "qr", label: "QR" },
    { id: "seo", label: "SEO" },
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
      whatsapp: gym.whatsapp || "",
      phone: gym.phone || "",
      email: gym.email || "",
      default_schedule_capacity:
        gym.default_schedule_capacity ?? "",
      payment_due_day: gym.payment_due_day ?? "",
      access_block_day: gym.access_block_day ?? "",
      allow_plan_changes: gym.allow_plan_changes ?? false,
      allow_schedule_changes: gym.allow_schedule_changes ?? false,
      schedule_change_cooldown_days:
        gym.schedule_change_cooldown_hours == null
          ? ""
          : Number(gym.schedule_change_cooldown_hours) / 24,
      max_schedule_changes_per_month: gym.max_schedule_changes_per_month ?? "",
      schedule_change_notice_days:
        gym.schedule_change_notice_hours == null
          ? ""
          : Number(gym.schedule_change_notice_hours) / 24,
      qr_attendance_message: gym.qr_attendance_message || "",
      qr_registration_message: gym.qr_registration_message || "",
      seo_title: gym.seo_title || "",
      seo_description: gym.seo_description || "",
      seo_keywords: gym.seo_keywords || "",
      seo_city: gym.seo_city || "",
      seo_address: gym.seo_address || "",
      seo_hours: gym.seo_hours || "",
    });
  }, [gym]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!validate()) return;

    try {
      setIsSubmitting(true);

      const data = new FormData();

      data.append("name", formData.name);
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
      if (formData.schedule_change_cooldown_days !== "") {
        data.append(
          "schedule_change_cooldown_hours",
          Number(formData.schedule_change_cooldown_days) * 24,
        );
      }
      if (formData.max_schedule_changes_per_month !== "") {
        data.append("max_schedule_changes_per_month", formData.max_schedule_changes_per_month);
      }
      if (formData.schedule_change_notice_days !== "") {
        data.append(
          "schedule_change_notice_hours",
          Number(formData.schedule_change_notice_days) * 24,
        );
      }
      data.append("allow_schedule_changes", formData.allow_schedule_changes);
      data.append("allow_plan_changes", formData.allow_plan_changes);

      data.append("qr_attendance_message", formData.qr_attendance_message);
      data.append(
        "qr_registration_message",
        formData.qr_registration_message,
      );

      data.append("seo_title", formData.seo_title);
      data.append("seo_description", formData.seo_description);
      data.append("seo_keywords", formData.seo_keywords);
      data.append("seo_city", formData.seo_city);
      data.append("seo_address", formData.seo_address);
      data.append("seo_hours", formData.seo_hours);

      if (logoFile) {
        data.append("logo", logoFile);
      }
      if (iconFile) {
        data.append("app_icon", iconFile);
      }

      await updateGym(data);

      toast.success("Configuración actualizada correctamente");

      queryClient.invalidateQueries({ queryKey: ["gym"] });
    } catch (error) {
      toast.error(error.message || "No se pudo actualizar la configuración");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (role && role !== "owner") {
    navigate("/dashboard", { replace: true });
    return null;
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

      <p className="mb-4 text-text-secondary">Información básica del gimnasio.</p>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-primary text-white"
                : "bg-surface-input text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border bg-surface-elevated p-6"
      >
        {activeTab === "info" && (
        <>
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

        <div className="mb-8 flex flex-col items-center rounded-xl border border-border/10 p-4">
          <p className="mb-3 text-sm font-medium text-text-primary">
            Icono de la aplicación
          </p>
          <p className="mb-3 text-center text-xs text-text-secondary">
            Aparece en la pestaña del navegador y como icono de instalación.
            Se recomienda una imagen cuadrada.
          </p>
          <div className="mb-4">
            {iconFile ? (
              <img
                src={URL.createObjectURL(iconFile)}
                alt="Preview icono"
                className="h-20 w-20 rounded-2xl border border-border/10 object-cover"
              />
            ) : gym.app_icon_url ? (
              <img
                src={gym.app_icon_url}
                alt={gym.name}
                className="h-20 w-20 rounded-2xl border border-border/10 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border/10 bg-primary text-2xl font-bold text-white">
                {gym?.name?.charAt(0)?.toUpperCase() || "G"}
              </div>
            )}
          </div>

          <label className="cursor-pointer rounded-xl border border-border/10 px-4 py-2 text-sm text-text-primary transition hover:bg-surface-input">
            Cambiar icono
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setIconFile(e.target.files?.[0] || null)}
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

        </>
        )}
        {activeTab === "pagos" && (
        <>
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

        </>
        )}
        {activeTab === "planes" && (
        <>
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
          <label className="text-sm text-text-primary">Permitir cambios permanentes de horario</label>
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
            Cooldown entre cambios de horario (días)
          </label>
          <input
            type="number"
            min="0"
            value={formData.schedule_change_cooldown_days}
            onChange={(e) => setFormData({ ...formData, schedule_change_cooldown_days: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
          {errors.schedule_change_cooldown_days && (
            <p className="mt-1 text-xs text-danger-text dark:text-danger">{errors.schedule_change_cooldown_days}</p>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-primary">
            Máximo de cambios permanentes por mes
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
            Anticipación requerida para cambios de horario (días)
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

        </>
        )}
        {activeTab === "qr" && (
        <>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Mensajes de los códigos QR
        </h3>

        <p className="mb-4 text-xs text-text-secondary">
          Texto que se muestra en el cartel A4 junto a cada código QR cuando se
          imprime para colocar en recepción.
        </p>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-primary">
            Mensaje del QR de asistencia
          </label>
          <input
            type="text"
            value={formData.qr_attendance_message}
            onChange={(e) =>
              setFormData({
                ...formData,
                qr_attendance_message: e.target.value,
              })
            }
            placeholder="Ej: Marcá tu asistencia acá"
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-text-primary">
            Mensaje del QR de registro de socios
          </label>
          <input
            type="text"
            value={formData.qr_registration_message}
            onChange={(e) =>
              setFormData({
                ...formData,
                qr_registration_message: e.target.value,
              })
            }
            placeholder="Ej: Registrate como socio con el celu"
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
        </div>

        </>
        )}
        {activeTab === "seo" && (
        <>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Posicionamiento Web (SEO)
        </h3>

        <p className="mb-4 text-xs text-text-secondary">
          Estos datos se usan para que tu gimnasio aparezca en Google al
          compartir tu link de registro. Completalos para mejorar tu
          posicionamiento local.
        </p>

        <div className="mb-6 rounded-xl border border-border bg-white px-4 py-3">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200">
              {gym?.logo_url ? (
                <img
                  src={gym.logo_url}
                  alt={gym.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-gray-500">
                  {gym?.name?.charAt(0)?.toUpperCase() || "G"}
                </span>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-black">
                {gym.name}
              </p>
              <p className="text-[10px] text-black/60">
                {gym.seo_city ? `${gym.seo_city} · ` : ""}
                {gym.seo_address ? `${gym.seo_address} · ` : ""}
                Sitio web
              </p>
            </div>
          </div>
          <p className="truncate text-[11px] text-green-700">
            {window.location.origin}/register/{gym.onboarding_code}
          </p>
          <p className="mt-1 line-clamp-2 cursor-pointer text-lg text-[#1a0dab] hover:underline">
            {formData.seo_title.trim() ||
              `${gym.name} | Registrate como socio`}
          </p>
          <p className="text-[11px] leading-snug text-gray-600">
            {formData.seo_description.trim() ||
              `Registrate como socio en ${gym.name}.`}
          </p>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-primary">
            Título para Google
          </label>
          <input
            type="text"
            maxLength="120"
            value={formData.seo_title}
            onChange={(e) =>
              setFormData({ ...formData, seo_title: e.target.value })
            }
            placeholder="Ej: Gimnasio Atlas | Musculación y CrossFit en Rosario"
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-primary">
            Descripción para Google
          </label>
          <textarea
            rows="3"
            maxLength="160"
            value={formData.seo_description}
            onChange={(e) =>
              setFormData({ ...formData, seo_description: e.target.value })
            }
            placeholder="Ej: Sumate al mejor gimnasio de Rosario. Musculación, crossfit y clases guiadas con profesores certificados."
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
          <p className="mt-1 text-xs text-text-secondary">
            {formData.seo_description.length}/160 caracteres
          </p>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-primary">
            Palabras clave
          </label>
          <input
            type="text"
            value={formData.seo_keywords}
            onChange={(e) =>
              setFormData({ ...formData, seo_keywords: e.target.value })
            }
            placeholder="Ej: gimnasio, musculación, crossfit, rosario"
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-primary">
            Ciudad
          </label>
          <input
            type="text"
            value={formData.seo_city}
            onChange={(e) =>
              setFormData({ ...formData, seo_city: e.target.value })
            }
            placeholder="Ej: Rosario"
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-text-primary">
            Dirección
          </label>
          <input
            type="text"
            value={formData.seo_address}
            onChange={(e) =>
              setFormData({ ...formData, seo_address: e.target.value })
            }
            placeholder="Ej: Av. Pellegrini 1234"
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-text-primary">
            Horarios de atención
          </label>
          <textarea
            rows="2"
            value={formData.seo_hours}
            onChange={(e) =>
              setFormData({ ...formData, seo_hours: e.target.value })
            }
            placeholder="Ej: Lun a Vie 8 a 22, Sáb 9 a 14, Dom cerrado"
            className="w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none"
          />
        </div>
        </>
        )}

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

        <button
          onClick={() => navigate("/staff")}
          className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm text-text-primary transition hover:bg-surface-input"
        >
          <Users size={18} className="text-primary" />

          <span>Gestionar staff</span>
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
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                value={newSlot.day}
                onChange={(e) =>
                  setNewSlot({ ...newSlot, day: e.target.value })
                }
                className="flex-1 basis-28 rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none"
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
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-input px-4 py-3"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-3">
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
                        : "Cap. por defecto"}
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
