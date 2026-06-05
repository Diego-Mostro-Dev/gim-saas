import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useGym } from "../hooks/useGym";
import { updateGym } from "../services/gym.service";

function Settings() {
  const { gym } = useGym();

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!gym) return;

    setFormData({
      name: gym.name || "",
      slug: gym.slug || "",
    });
  }, [gym]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      await updateGym({
        name: formData.name,
        slug: formData.slug,
      });

      toast.success("Configuración actualizada correctamente");
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
      <h1 className="mb-2 text-3xl font-bold text-white">Configuración</h1>

      <p className="mb-6 text-zinc-400">Información básica del gimnasio.</p>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/10 bg-[#201f1f] p-6"
      >
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-pink-500 px-4 py-3 font-medium text-white transition active:scale-95 disabled:opacity-50"
        >
          {isSubmitting ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}

export default Settings;
