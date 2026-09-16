import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Users, Shield, KeyRound, Pencil } from "lucide-react";
import toast from "react-hot-toast";

import useAuthStore from "../store/auth.store";
import { getStaff, createStaff, deleteStaff, updateStaffRole, adminResetPassword } from "../services/staff.service";
import { useGym } from "../hooks/useGym";
import { txt } from "../utils/labels";

function Staff({ embedded = false }) {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const { gym } = useGym();

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "staff",
  });

  const [resetModalUser, setResetModalUser] = useState(null);
  const [newPasswordReset, setNewPasswordReset] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const [roleModalUser, setRoleModalUser] = useState(null);
  const [newRole, setNewRole] = useState("staff");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  async function loadStaff() {
    setLoading(true);
    try {
      const data = await getStaff();
      setStaff(data);
    } catch (error) {
      toast.error(error.message || "Error al cargar el staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const loadTimer = setTimeout(loadStaff, 0);
    return () => clearTimeout(loadTimer);
  }, []);

  async function handleCreate(e) {
    e.preventDefault();

    if (!form.username || !form.password) {
      toast.error("Usuario y contraseña son obligatorios");
      return;
    }

    try {
      setIsSubmitting(true);
      await createStaff(form);
      toast.success("Staff creado correctamente");
      setShowCreate(false);
      setForm({ username: "", email: "", password: "", role: "staff" });
      loadStaff();
    } catch (error) {
      toast.error(error.message || "No se pudo crear el staff");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(user) {
    if (!window.confirm(`¿Eliminar al usuario "${user.username}"?`)) return;

    try {
      await deleteStaff(user.id);
      toast.success("Staff eliminado");
      loadStaff();
    } catch (error) {
      toast.error(error.message || "No se pudo eliminar el staff");
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();

    if (!newPasswordReset || newPasswordReset.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    try {
      setIsResetting(true);
      await adminResetPassword(resetModalUser.id, newPasswordReset);
      toast.success(
        `Contraseña de "${resetModalUser.username}" restablecida. El usuario deberá cambiarla al iniciar sesión.`
      );
      setResetModalUser(null);
      setNewPasswordReset("");
    } catch (error) {
      toast.error(error.message || "No se pudo restablecer la contraseña");
    } finally {
      setIsResetting(false);
    }
  }

  async function handleUpdateRole(e) {
    e.preventDefault();

    if (!roleModalUser || !["staff", "professor"].includes(newRole)) return;

    try {
      setIsUpdatingRole(true);
      await updateStaffRole(roleModalUser.id, newRole);
      toast.success(
        `Rol de "${roleModalUser.username}" actualizado a ${
          newRole === "professor" ? "Profesor" : "Staff"
        }.`
      );
      setRoleModalUser(null);
      loadStaff();
    } catch (error) {
      toast.error(error.message || "No se pudo actualizar el rol");
    } finally {
      setIsUpdatingRole(false);
    }
  }

  const renderUserRow = (user) => (
    <div
      key={user.id}
      className="flex items-center justify-between rounded-xl bg-surface-input px-4 py-3"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">
          {user.username}
        </p>
        {user.email && (
          <p className="truncate text-xs text-text-secondary">{user.email}</p>
        )}
        <span
          className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            user.role === "professor"
              ? "bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
              : "bg-surface-elevated text-text-secondary"
          }`}
        >
          {user.role === "professor" ? "Profesor" : "Staff"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setRoleModalUser(user);
            setNewRole(user.role);
          }}
          className="shrink-0 rounded-lg border border-border p-1.5 text-text-secondary transition hover:bg-surface-input"
          title="Editar rol"
        >
          <Pencil size={16} />
        </button>

        <button
          onClick={() => {
            setResetModalUser(user);
            setNewPasswordReset("");
          }}
          className="shrink-0 rounded-lg border border-border p-1.5 text-text-secondary transition hover:bg-surface-input"
          title="Restablecer contraseña"
        >
          <KeyRound size={16} />
        </button>

        <button
          onClick={() => handleDelete(user)}
          className="shrink-0 rounded-lg bg-danger-bg dark:bg-danger/15 p-1.5 text-danger-text dark:text-danger transition hover:bg-danger/30"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  if (!embedded && role && role !== "owner") {
    return (
      <div className="mx-auto max-w-xl">
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-primary transition hover:bg-surface-input"
        >
          <ArrowLeft size={18} />
          Volver
        </button>

        <div className="rounded-xl border border-border bg-surface-elevated p-6">
          <p className="text-sm text-text-secondary">
            No tenés permisos para gestionar el staff.
          </p>
        </div>
      </div>
    );
  }

  const owner = staff.find((u) => u.role === "owner");
  const regularStaff = staff.filter((u) => u.role === "staff");
  const professors = staff.filter((u) => u.role === "professor");

  return (
    <div className="mx-auto max-w-xl">
      {!embedded && (
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-primary transition hover:bg-surface-input"
        >
          <ArrowLeft size={18} />
          Volver
        </button>
      )}

      {!embedded && (
        <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold text-text-primary">
          <Users size={26} />
          Staff
        </h1>
      )}

      <p className="mb-6 text-text-secondary">
        {txt(gym, "staff.staff.title")}
      </p>

      {owner && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <Shield size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-text-primary">{owner.username}</p>
              <p className="text-xs text-info-text dark:text-info">Dueño</p>
            </div>
          </div>
          {owner.email && (
            <span className="ml-2 shrink-0 truncate text-xs text-text-secondary">{owner.email}</span>
          )}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Staff ({regularStaff.length + professors.length})
        </h2>

        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-white transition active:scale-95"
        >
          <Plus size={14} />
          Agregar
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-4 space-y-3 rounded-xl border border-border bg-surface-input p-4"
        >
          <div>
            <label className="mb-1 block text-xs text-text-secondary">
              Nombre de usuario
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">
              Email (opcional)
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">
              Contraseña
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-secondary">
              Rol
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none"
            >
              <option value="staff">Staff</option>
              <option value="professor">Profesor</option>
            </select>
            <p className="mt-1 text-xs text-text-secondary">
              El profesor solo puede gestionar rutinas.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-border px-3 py-2 text-xs text-text-primary transition hover:bg-surface-input"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white transition active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? "Creando..." : "Crear staff"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-4 text-center text-sm text-text-secondary">
          Cargando...
        </div>
      ) : regularStaff.length === 0 && professors.length === 0 ? (
        <div className="rounded-xl bg-surface-input px-4 py-3 text-sm text-text-secondary">
          No hay staff. Agregá usuarios para que accedan al panel.
        </div>
      ) : (
        <div className="space-y-4">
          {regularStaff.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Staff
              </h3>
              {regularStaff.map(renderUserRow)}
            </div>
          )}

          {professors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-info-text dark:text-info">
                Profesores
              </h3>
              {professors.map(renderUserRow)}
            </div>
          )}
        </div>
      )}

      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-surface-elevated p-6">
            <h2 className="mb-1 text-lg font-semibold text-text-primary">
              Restablecer contraseña
            </h2>

            <p className="mb-4 text-sm text-text-secondary">
              Nueva contraseña para{" "}
              <strong>{resetModalUser.username}</strong>. El usuario deberá
              cambiarla al iniciar sesión.
            </p>

            <form onSubmit={handleResetPassword}>
              <input
                type="password"
                className="mb-4 w-full rounded-xl border border-border/10 bg-surface px-4 py-3 text-text-primary outline-none"
                placeholder="Nueva contraseña (mínimo 8 caracteres)"
                value={newPasswordReset}
                onChange={(e) => setNewPasswordReset(e.target.value)}
                autoFocus
                required
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetModalUser(null);
                    setNewPasswordReset("");
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

      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-surface-elevated p-6">
            <h2 className="mb-1 text-lg font-semibold text-text-primary">
              Editar rol
            </h2>

            <p className="mb-4 text-sm text-text-secondary">
              Cambiar el rol de <strong>{roleModalUser.username}</strong>.
            </p>

            <form onSubmit={handleUpdateRole}>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="mb-4 w-full rounded-xl border border-border/10 bg-surface px-4 py-3 text-text-primary outline-none"
                autoFocus
              >
                <option value="staff">Staff</option>
                <option value="professor">Profesor</option>
              </select>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  className="rounded-lg border border-border px-3 py-2 text-xs text-text-primary transition hover:bg-surface-input"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isUpdatingRole || newRole === roleModalUser.role}
                  className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white transition active:scale-95 disabled:opacity-50"
                >
                  {isUpdatingRole ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Staff;
