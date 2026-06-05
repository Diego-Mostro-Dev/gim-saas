import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { apiFetch } from "../services/api";
import useAuthStore from "../store/auth.store";

function ChangePassword() {
  const navigate = useNavigate();

  const clearMustChangePassword = useAuthStore(
    (state) => state.clearMustChangePassword,
  );

  const [formData, setFormData] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (formData.new_password !== formData.confirm_password) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    try {
      setIsSubmitting(true);

      await apiFetch("/api/auth/change-password/", {
        method: "POST",
        body: JSON.stringify({
          old_password: formData.old_password,
          new_password: formData.new_password,
        }),
      });

      clearMustChangePassword();

      toast.success("Contraseña actualizada correctamente");

      navigate("/dashboard", {
        replace: true,
      });
    } catch (error) {
      toast.error(error.message || "No se pudo actualizar la contraseña");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#141414] p-6">
      <div className="mx-auto max-w-md rounded-2xl bg-[#201f1f] p-6">
        <h1 className="mb-2 text-2xl font-bold text-white">
          Cambiar contraseña
        </h1>

        <p className="mb-6 text-sm text-zinc-400">
          Debés cambiar tu contraseña antes de continuar.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Contraseña actual
            </label>

            <input
              type="password"
              value={formData.old_password}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  old_password: e.target.value,
                })
              }
              className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Nueva contraseña
            </label>

            <input
              type="password"
              value={formData.new_password}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  new_password: e.target.value,
                })
              }
              className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-300">
              Confirmar contraseña
            </label>

            <input
              type="password"
              value={formData.confirm_password}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  confirm_password: e.target.value,
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
            {isSubmitting ? "Actualizando..." : "Actualizar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangePassword;
