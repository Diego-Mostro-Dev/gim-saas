import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Building2, Copy, KeyRound, Link2, Pencil, Plus, UserRound } from "lucide-react";

import {
  adminListFeatures,
  adminListGyms,
  adminResetPassword,
} from "../../services/admin.service";
import { formatHumanDate } from "../../utils/date.utils";

function copyText(text, label) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${label} copiado`))
    .catch(() => toast.error("No se pudo copiar"));
}

/** Solo permite enlaces http/https; devuelve null para schemes peligrosos (javascript:, data:, etc.). */
function safeOnboardingHref(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch {
    return null;
  }
  return null;
}

export default function AdminGyms() {
  const navigate = useNavigate();
  const [gyms, setGyms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("activos");
  const [catalogKeys, setCatalogKeys] = useState(null);
  const [resetModalGym, setResetModalGym] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [data, features] = await Promise.all([
          adminListGyms(),
          adminListFeatures().catch(() => null),
        ]);
        setGyms(data);
        setCatalogKeys((features?.features || []).map((f) => f.key));
      } catch (error) {
        toast.error(error.message || "Error al listar gimnasios");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const counts = useMemo(() => {
    const base = {
      activos: 0,
      inactivos: 0,
      todos: gyms?.length || 0,
    };
    for (const g of gyms || []) {
      if (g.active) base.activos += 1;
      else base.inactivos += 1;
    }
    return base;
  }, [gyms]);

  const visibleGyms = useMemo(() => {
    if (!gyms) return [];
    if (filter === "todos") return gyms;
    const wantActive = filter === "activos";
    return gyms.filter((g) => g.active === wantActive);
  }, [gyms, filter]);

  const filters = [
    { key: "activos", label: "Activos" },
    { key: "inactivos", label: "Inactivos" },
    { key: "todos", label: "Todos" },
  ];

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
            {gyms
              ? `${counts.activos} activos · ${counts.inactivos} inactivos`
              : ""}
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

      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-border bg-surface-input p-0.5">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                filter === key
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {label}
              <span className="ml-1 opacity-70">{counts[key]}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-text-secondary">
          Mostrando {visibleGyms.length}
          {filter === "activos"
            ? " activos"
            : filter === "inactivos"
              ? " inactivos"
              : " gimnasios"}
        </p>
      </div>

      {gyms && visibleGyms.length === 0 && (
        <div className="rounded-xl border border-border bg-surface-elevated p-8 text-center">
          <Building2 className="mx-auto mb-2 text-text-secondary" size={32} />
          <p className="text-sm text-text-secondary">
            {filter === "inactivos"
              ? "No hay gimnasios inactivos."
              : "Todavía no hay gimnasios creados."}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {visibleGyms.map((gym) => {
          const featuresOn = Object.entries(gym.features || {})
            .filter(([key, enabled]) => {
              if (catalogKeys && !catalogKeys.includes(key)) return false;
              return Boolean(enabled);
            })
            .map(([key]) => key);

          const safeOnboardingUrl = safeOnboardingHref(gym.onboarding_url);

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
                {gym.owner_user_id && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetModalGym(gym);
                      setNewPassword("");
                      setIsResetting(false);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-text-primary hover:bg-surface-input"
                    title={`Restablecer contraseña del owner ${gym.owner_username || ""}`}
                  >
                    <KeyRound size={14} />
                    Renovar contraseña
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/admin/gyms/${gym.id}`)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-text-primary hover:bg-surface-input"
                >
                  <Pencil size={14} />
                  Editar
                </button>
                {safeOnboardingUrl && (
                  <a
                    href={safeOnboardingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-text-primary hover:bg-surface-input"
                  >
                    Abrir
                  </a>
                )}
                <span className="ml-auto text-text-secondary">
                  Creado {formatHumanDate(gym.created_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {resetModalGym && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-surface-elevated p-6">
            <h2 className="mb-1 text-lg font-semibold text-text-primary">
              Renovar contraseña del owner
            </h2>

            <p className="mb-4 text-sm text-text-secondary">
              Nueva contraseña para{" "}
              <strong>
                {resetModalGym.owner_username || resetModalGym.name}
              </strong>
              . El owner deberá cambiarla al iniciar sesión.
            </p>

            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (newPassword.length < 8) {
                  toast.error("La contraseña debe tener al menos 8 caracteres.");
                  return;
                }
                setIsResetting(true);
                try {
                  await adminResetPassword(
                    resetModalGym.owner_user_id,
                    newPassword
                  );
                  toast.success(
                    "Contraseña del owner restablecida correctamente."
                  );
                  setResetModalGym(null);
                  setNewPassword("");
                } catch (error) {
                  toast.error(error.message || "Error al restablecer contraseña");
                } finally {
                  setIsResetting(false);
                }
              }}
            >
              <input
                type="password"
                className="mb-4 w-full rounded-xl border border-border/10 bg-surface-input px-4 py-3 text-text-primary outline-none"
                placeholder="Nueva contraseña (mínimo 8 caracteres)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
                required
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetModalGym(null);
                    setNewPassword("");
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-xs text-text-primary transition hover:bg-surface-input"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isResetting}
                  className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white transition active:scale-95 disabled:opacity-50"
                >
                  {isResetting ? "Guardando..." : "Restablecer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}