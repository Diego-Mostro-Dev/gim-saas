import { useState } from "react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const response = await fetch(
        "https://gim-saas.onrender.com/api/auth/login/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error("Credenciales inválidas");
      }

      localStorage.setItem("token", data.token);

      window.location.href = "/dashboard";
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-zinc-900 p-6"
      >
        <h1 className="mb-4 text-xl text-white">Iniciar sesión</h1>

        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-3 w-full rounded bg-zinc-800 p-3 text-white"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full rounded bg-zinc-800 p-3 text-white"
        />

        <button
          type="submit"
          className="w-full rounded bg-blue-600 p-3 text-white"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
