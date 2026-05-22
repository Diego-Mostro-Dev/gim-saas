import {
  LayoutGrid,
  BarChart3,
  Users,
  Settings,
} from "lucide-react";

import { NavLink } from "react-router-dom";

function BottomNav() {
  const baseClass =
    "flex flex-col items-center px-4 py-2";

  const activeClass =
    "rounded-xl bg-purple-500/20 text-blue-300";

  const inactiveClass =
    "text-zinc-400";

  return (
    <nav className="fixed bottom-0 z-50 flex h-20 w-full items-center justify-around border-t border-white/10 bg-[#201f1f] px-2">
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          `${baseClass} ${
            isActive
              ? activeClass
              : inactiveClass
          }`
        }
      >
        <LayoutGrid size={20} />

        <span className="text-xs">
          Inicio
        </span>
      </NavLink>

      <button
        className={`${baseClass} ${inactiveClass}`}
      >
        <BarChart3 size={20} />

        <span className="text-xs">
          Métricas
        </span>
      </button>

      <NavLink
        to="/members"
        className={({ isActive }) =>
          `${baseClass} ${
            isActive
              ? activeClass
              : inactiveClass
          }`
        }
      >
        <Users size={20} />

        <span className="text-xs">
          Miembros
        </span>
      </NavLink>

      <button
        className={`${baseClass} ${inactiveClass}`}
      >
        <Settings size={20} />

        <span className="text-xs">
          Configuración
        </span>
      </button>
    </nav>
  );
}

export default BottomNav;