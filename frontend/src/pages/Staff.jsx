import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Users, Shield } from "lucide-react";
import toast from "react-hot-toast";

import useAuthStore from "../store/auth.store";
import { getStaff, createStaff, deleteStaff } from "../services/staff.service";

function Staff() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

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
    loadStaff();
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
      setForm({ username: "", email: "", password: "" });
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

  if (role && role !== "owner") {
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
  const staffMembers = staff.filter((u) => u.role !== "owner");

  return (
    <div className="mx-auto max-w-xl">
      <button
        onClick={() => navigate("/dashboard")}
        className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-primary transition hover:bg-surface-input"
      >
        <ArrowLeft size={18} />
        Volver
      </button>

      <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold text-text-primary">
        <Users size={26} />
        Staff
      </h1>

      <p className="mb-6 text-text-secondary">
        Usuarios que pueden acceder al panel del gimnasio.
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
          Staff ({staffMembers.length})
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
      ) : staffMembers.length === 0 ? (
        <div className="rounded-xl bg-surface-input px-4 py-3 text-sm text-text-secondary">
          No hay staff. Agregá usuarios para que accedan al panel.
        </div>
      ) : (
        <div className="space-y-2">
          {staffMembers.map((user) => (
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
              </div>

              <button
                onClick={() => handleDelete(user)}
                className="ml-2 shrink-0 rounded-lg bg-danger-bg dark:bg-danger/15 p-1.5 text-danger-text dark:text-danger transition hover:bg-danger/30"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Staff;
