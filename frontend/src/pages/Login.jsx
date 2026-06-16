import { useState } from "react";
import useAuthStore from "../store/auth.store";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);

  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    const success = await login({ username, password });

    if (success) {
      navigate("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-surface-elevated p-6"
      >
        <h1 className="mb-4 text-xl text-text-primary">Iniciar sesión</h1>

        <input
          className="mb-3 w-full rounded bg-surface-input p-3 text-text-primary"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          className="mb-3 w-full rounded bg-surface-input p-3 text-text-primary"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="mb-2 text-sm text-danger">{error}</p>}

        <button
          disabled={loading}
          className="w-full rounded bg-primary p-3 text-white disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
