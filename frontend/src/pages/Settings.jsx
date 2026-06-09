import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, QrCode } from "lucide-react";
import toast from "react-hot-toast";

import { useGym } from "../hooks/useGym";
import { updateGym } from "../services/gym.service";

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
    </div>
  );
}

export default Settings;
