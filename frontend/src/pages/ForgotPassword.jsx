import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { apiFetch } from "../services/api";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      await apiFetch("/api/auth/password-reset/request/", {
        method: "POST",
        skipAuth: true,
        suppressUnauthorized: true,
        body: JSON.stringify({ email }),
      });

      setIsSubmitted(true);
    } catch (error) {
      toast.error(error.message || "No se pudo enviar el enlace");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-xl bg-surface-elevated p-6">
        <h1 className="mb-2 text-xl text-text-primary">
          Recuperar contraseña
        </h1>

        {isSubmitted ? (
          <div>
            <p className="mb-4 text-sm leading-relaxed text-text-secondary">
              Si el email está registrado, vas a recibir un enlace para
              restablecer tu contraseña. Revisá también la carpeta de spam.
            </p>

            <Link
              to="/login"
              className="block w-full rounded bg-primary p-3 text-center text-white"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-text-secondary">
              Ingresá el email de tu cuenta y te vamos a enviar un enlace para
              restablecer tu contraseña.
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded bg-primary p-3 text-white disabled:opacity-50"
              >
                {isSubmitting ? "Enviando..." : "Enviar enlace"}
              </button>
            </form>

            <Link
              to="/login"
              className="mt-4 block text-center text-sm text-text-secondary hover:text-text-primary"
            >
              Volver a iniciar sesión
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;