import { Menu, LogOut, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useGym } from "../../hooks/useGym";

function TopBar() {
  const { gym } = useGym();

  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/10 bg-[#131313]/80 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Menu className="text-blue-400" size={22} />
      </div>

      <div className="flex min-w-0 items-center gap-3">
        {gym?.logo_url ? (
          <img
            src={gym.logo_url}
            alt={gym.name}
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500 font-bold text-white">
            {gym?.name?.charAt(0)?.toUpperCase() || "G"}
          </div>
        )}

        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold tracking-wider text-white">
            {gym?.name?.toUpperCase() || "GYM"}
          </h1>

          <p className="text-xs text-zinc-500">Dashboard</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/settings"
          className="rounded-lg border border-white/10 p-2 text-zinc-300 transition hover:bg-white/5"
        >
          <Settings size={18} />
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/20"
        >
          <LogOut size={16} />
          Salir
        </button>
      </div>
    </header>
  );
}

export default TopBar;
