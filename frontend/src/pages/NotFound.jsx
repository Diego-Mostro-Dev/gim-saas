import { useNavigate } from "react-router-dom";

function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 text-center">
      <h1 className="text-6xl font-bold text-accent">404</h1>
      <p className="mt-4 text-lg text-text-secondary">
        La página que buscás no existe.
      </p>
      <button
        onClick={() => navigate("/dashboard")}
        className="mt-8 rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:opacity-90"
      >
        Volver al inicio
      </button>
    </div>
  );
}

export default NotFound;
