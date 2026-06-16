import { LogOut, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useGym } from "../../hooks/useGym";
import ThemeToggle from "../ui/ThemeToggle";

function TopBar() {
  const { gym } = useGym();

  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-border/10 bg-surface/80 px-4 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        {gym?.logo_url ? (
          <img
            src={gym.logo_url}
            alt={gym.name}
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary font-bold text-white">
            {gym?.name?.charAt(0)?.toUpperCase() || "G"}
          </div>
        )}

        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold tracking-wider text-text-primary">
            {gym?.name?.toUpperCase() || "GYM"}
          </h1>

          <p className="text-xs text-text-secondary">Panel</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <Link
          to="/settings"
          className="rounded-lg border border-border/10 p-2 text-text-secondary transition hover:bg-surface-input"
        >
          <Settings size={18} />
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-bg dark:bg-danger/15 px-3 py-2 text-sm text-danger-text dark:text-danger transition hover:bg-danger-bg dark:hover:bg-danger/20"
        >
          <LogOut size={16} />
          Salir
        </button>
      </div>
    </header>
  );
}

export default TopBar;
