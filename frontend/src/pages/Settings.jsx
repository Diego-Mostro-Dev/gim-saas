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
  });

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
    });
  }, [gym]);

  async function handleSubmit(e) {
    e.preventDefault();

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
    return <div className="p-4 text-white">Cargando...</div>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <button
        onClick={() => navigate("/dashboard")}
        className="mb-4 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
      >
        <ArrowLeft size={18} />
        Volver
      </button>

      <h1 className="mb-2 text-3xl font-bold text-white">Configuración</h1>

      <p className="mb-6 text-zinc-400">Información básica del gimnasio.</p>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/10 bg-[#201f1f] p-6"
      >
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4">
            {logoFile ? (
              <img
                src={URL.createObjectURL(logoFile)}
                alt="Preview"
                className="h-32 w-32 rounded-3xl border border-white/10 object-cover"
              />
            ) : gym.logo_url ? (
              <img
                src={gym.logo_url}
                alt={gym.name}
                className="h-32 w-32 rounded-3xl border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-3xl border border-white/10 bg-pink-500 text-5xl font-bold text-white">
                {gym?.name?.charAt(0)?.toUpperCase() || "G"}
              </div>
            )}
          </div>

          <label className="cursor-pointer rounded-xl border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/5">
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
          <label className="mb-2 block text-sm text-zinc-300">Nombre</label>

          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData({
                ...formData,
                name: e.target.value,
              })
            }
            className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-white outline-none"
            required
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-zinc-300">Slug</label>

          <input
            type="text"
            value={formData.slug}
            onChange={(e) =>
              setFormData({
                ...formData,
                slug: e.target.value,
              })
            }
            className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-white outline-none"
            required
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-zinc-300">
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
            className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-white outline-none"
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-zinc-300">
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
            className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-white outline-none"
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-zinc-300">
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
            className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-white outline-none"
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm text-zinc-300">
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
            className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-white outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-pink-500 px-4 py-3 font-medium text-white transition active:scale-95 disabled:opacity-50"
        >
          {isSubmitting ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#201f1f] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Códigos QR
        </h2>

        <button
          onClick={() => navigate("/registration")}
          className="flex w-full items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-white transition hover:bg-white/5"
        >
          <QrCode size={18} className="text-pink-300" />

          <span>Registro de miembros</span>
        </button>

        <button
          onClick={() => navigate("/attendance-qr")}
          className="flex w-full items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm text-white transition hover:bg-white/5"
        >
          <QrCode size={18} className="text-green-400" />

          <span>Asistencia QR</span>
        </button>
      </div>

      {/* Horarios disponibles */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-[#201f1f] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Horarios disponibles
          </h2>

          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1 rounded-xl bg-pink-500 px-3 py-1.5 text-xs font-medium text-white transition active:scale-95"
          >
            <Plus size={14} />
            Agregar
          </button>
        </div>

        {showCreateForm && (
          <form
            onSubmit={handleCreateSlot}
            className="mb-4 rounded-xl border border-white/10 bg-[#2a2a2a] p-3"
          >
            <div className="mb-3 flex items-center gap-2">
              <select
                value={newSlot.day}
                onChange={(e) =>
                  setNewSlot({ ...newSlot, day: e.target.value })
                }
                className="flex-1 rounded-lg bg-[#141414] px-3 py-2 text-sm text-white outline-none"
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
                className="rounded-lg bg-[#141414] px-3 py-2 text-sm text-white outline-none"
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
                className="w-24 rounded-lg bg-[#141414] px-3 py-2 text-sm text-white outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/5"
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
          <div className="py-4 text-center text-sm text-zinc-500">
            Cargando horarios...
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-xl bg-[#2a2a2a] px-4 py-3 text-sm text-zinc-500">
            No hay horarios configurados
          </div>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between rounded-xl bg-[#2a2a2a] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white">
                    {DAY_LABELS[slot.day]}
                  </span>

                  <span className="text-sm text-zinc-300">
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
                        className="w-16 rounded-lg bg-[#141414] px-2 py-1 text-xs text-white outline-none"
                      />

                      <button
                        onClick={() => handleUpdateCapacity(slot.id)}
                        className="rounded-lg bg-green-500/20 p-1 text-green-400 transition hover:bg-green-500/30"
                      >
                        <Check size={14} />
                      </button>

                      <button
                        onClick={() => setEditingSlotId(null)}
                        className="rounded-lg bg-red-500/20 p-1 text-red-400 transition hover:bg-red-500/30"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-400">
                      {slot.capacity !== null && slot.capacity !== undefined
                        ? `Cap: ${slot.capacity}`
                        : "(usar capacidad por defecto)"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(slot)}
                    className="rounded-lg bg-blue-500/20 p-1.5 text-blue-400 transition hover:bg-blue-500/30"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="rounded-lg bg-red-500/20 p-1.5 text-red-400 transition hover:bg-red-500/30"
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
