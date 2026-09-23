import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { apiFetch } from "../services/api";

function ResetPassword() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="w-full max-w-sm rounded-xl bg-surface-elevated p-6 text-center">
          <h1 className="mb-2 text-xl text-text-primary">
            Contraseña restablecida
          </h1>
          <p className="mb-4 text-sm text-text-secondary">
            Tu contraseña fue actualizada correctamente. Ya podés iniciar sesión
            con tu nueva contraseña.
          </p>
          <Link
            to="/login"
            className="block w-full rounded bg-primary p-3 text-white"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    try {
      setIsSubmitting(true);

      await apiFetch("/api/auth/password-reset/confirm/", {
        method: "POST",
        skipAuth: true,
        suppressUnauthorized: true,
        body: JSON.stringify({
          email,
          code: code.trim(),
          new_password: newPassword,
        }),
      });

      setIsSuccess(true);
    } catch (error) {
      toast.error(error.message || "No se pudo restablecer la contraseña");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-xl bg-surface-elevated p-6">
        <h1 className="mb-2 text-xl text-text-primary">
          Nueva contraseña
        </h1>

        <p className="mb-4 text-sm text-text-secondary">
          Ingresá tu email, el código que te enviamos por correo y tu nueva
          contraseña. Pedí el código desde la pantalla de login.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            className="mb-3 w-full rounded bg-surface-input p-3 text-text-primary"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            className="mb-3 w-full rounded bg-surface-input p-3 text-center text-lg tracking-[0.5em] text-text-primary"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
          />

          <input
            type="password"
            className="mb-3 w-full rounded bg-surface-input p-3 text-text-primary"
            placeholder="Nueva contraseña"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <input
            type="password"
            className="mb-3 w-full rounded bg-surface-input p-3 text-text-primary"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-primary p-3 text-white disabled:opacity-50"
          >
            {isSubmitting ? "Guardando..." : "Restablecer contraseña"}
          </button>
        </form>

        <Link
          to="/login"
          className="mt-4 block text-center text-sm text-text-secondary hover:text-text-primary"
        >
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}

export default ResetPassword;
