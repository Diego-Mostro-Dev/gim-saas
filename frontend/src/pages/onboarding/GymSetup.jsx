import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../../services/api";
import useAuthStore from "../../store/auth.store";

export default function GymSetup() {
  const { gymCode } = useParams();
  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [gymName, setGymName] = useState("");
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function validate() {
      try {
        const data = await apiFetch(
          `/api/auth/onboarding/validate/${gymCode}/`,
        );

        if (!data.valid) {
          setError("El enlace de registro no es válido o ha expirado.");
          setValidating(false);
          return;
        }

        setGymName(data.gym_name);
      } catch {
        setError("El enlace de registro no es válido o ha expirado.");
      } finally {
        setValidating(false);
      }
    }

    validate();
  }, [gymCode]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      setError("");

      const data = await apiFetch(
        "/api/auth/onboarding/create-owner/",
        {
          method: "POST",
          body: JSON.stringify({
            gym_code: gymCode,
            username,
            email,
            password,
          }),
        },
      );

      localStorage.setItem("token", data.token);

      useAuthStore.setState({
        token: data.token,
        user: { username: data.user },
        gym: { name: data.gym },
        must_change_password: data.must_change_password,
      });

      navigate("/change-password", { replace: true });
    } catch (err) {
      setError(err.message || "Error al crear la cuenta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        <p className="text-text-secondary">Verificando enlace...</p>
      </div>
    );
  }

  if (error && !gymName) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="w-full max-w-sm rounded-xl bg-surface-elevated p-6 text-center">
          <h1 className="mb-4 text-xl text-danger">Enlace inválido</h1>
          <p className="text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-text-primary">
            Configurar {gymName}
          </h1>
          <p className="mt-2 text-text-secondary">
            Creá tu cuenta de administrador para empezar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl bg-surface-elevated p-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-secondary">
              Usuario
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded bg-surface-input p-3 text-text-primary outline-none"
              placeholder="ej: admin"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-secondary">
              Email (opcional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded bg-surface-input p-3 text-text-primary outline-none"
              placeholder="ej: admin@gym.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-secondary">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded bg-surface-input p-3 text-text-primary outline-none"
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-primary p-3 font-medium text-white transition active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}
