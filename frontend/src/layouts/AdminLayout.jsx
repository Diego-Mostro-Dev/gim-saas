import { Outlet, Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";

import useAuthStore from "../store/auth.store";

export default function AdminLayout() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-surface-elevated/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <ShieldCheck size={18} />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-text-primary">Panel Central</p>
              <p className="text-xs text-text-secondary">Creación de gimnasios</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Link
              to="/admin"
              className="rounded-lg p-2 text-text-secondary hover:bg-surface-input hover:text-text-primary"
              title="Gimnasios"
            >
              <LayoutDashboard size={18} />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-2 text-text-secondary hover:bg-surface-input hover:text-danger"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-20 pb-28">
        <Outlet />
      </main>
    </div>
  );
}