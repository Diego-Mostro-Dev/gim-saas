import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Building2, Copy, Link2, Pencil, Plus, UserRound } from "lucide-react";

import { adminListGyms } from "../../services/admin.service";
import { formatHumanDate } from "../../utils/date.utils";

function copyText(text, label) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${label} copiado`))
    .catch(() => toast.error("No se pudo copiar"));
}

export default function AdminGyms() {
  const navigate = useNavigate();
  const [gyms, setGyms] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await adminListGyms();
        setGyms(data);
      } catch (error) {
        toast.error(error.message || "Error al listar gimnasios");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading && !gyms) {
    return (
      <div className="pt-10 text-center text-sm text-text-secondary">
        Cargando gimnasios...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Gimnasios</h1>
          <p className="text-sm text-text-secondary">
            {gyms ? `${gyms.length} creados` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/gyms/new")}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} />
          Nuevo gimnasio
        </button>
      </div>

      {gyms && gyms.length === 0 && (
        <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center">
          <Building2 className="mx-auto mb-2 text-text-secondary" size={32} />
          <p className="text-sm text-text-secondary">
            Todavía no hay gimnasios creados.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {gyms?.map((gym) => {
          const featuresOn = Object.entries(gym.features || {})
            .filter(([, enabled]) => enabled)
            .map(([key]) => key);

          return (
            <div
              key={gym.id}
              className="rounded-xl border border-border bg-surface-elevated p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {gym.logo_url ? (
                    <img
                      src={gym.logo_url}
                      alt={gym.name}
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-input text-text-secondary">
                      <Building2 size={18} />
                    </span>
                  )}
                  <div>
                    <p className="font-medium text-text-primary">{gym.name}</p>
                    <p className="text-xs text-text-secondary">/{gym.slug}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {gym.active ? (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                      Activo
                    </span>
                  ) : (
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                      Inactivo
                    </span>
                  )}
                </div>
              </div>

              {featuresOn.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {featuresOn.map((key) => (
                    <span
                      key={key}
                      className="rounded-full bg-info/15 px-2 py-0.5 text-xs text-info"
                    >
                      {key}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3 text-xs">
                <button
                  type="button"
                  onClick={() => copyText(gym.onboarding_url, "Link de onboarding")}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-text-primary hover:bg-surface-input"
                  title={gym.onboarding_url}
                >
                  <Link2 size={14} />
                  Onboarding
                  <Copy size={12} className="text-text-secondary" />
                </button>
                <button
                  type="button"
                  onClick={() => copyText(gym.register_url, "Link de registro")}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-text-primary hover:bg-surface-input"
                  title={gym.register_url}
                >
                  <UserRound size={14} />
                  Registro
                  <Copy size={12} className="text-text-secondary" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/gyms/${gym.id}`)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-text-primary hover:bg-surface-input"
                >
                  <Pencil size={14} />
                  Editar
                </button>
                <a
                  href={gym.onboarding_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-text-primary hover:bg-surface-input"
                >
                  Abrir
                </a>
                <span className="ml-auto text-text-secondary">
                  Creado {formatHumanDate(gym.created_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}