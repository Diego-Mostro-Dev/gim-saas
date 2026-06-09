import {
  LayoutGrid,
  CreditCard,
  Users,
  DollarSign,
  Dumbbell,
  CalendarDays,
  ClipboardList,
} from "lucide-react";

import { NavLink } from "react-router-dom";

function BottomNav() {
  const baseClass = "flex flex-col items-center px-2 py-2 transition";

  const activeClass = "rounded-xl bg-purple-500/20 text-blue-300";

  const inactiveClass = "text-zinc-400";

  return (
    <nav className="fixed bottom-0 z-50 flex h-20 w-full items-center justify-around gap-1 overflow-x-auto border-t border-white/10 bg-[#201f1f] px-2">
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          `${baseClass} ${isActive ? activeClass : inactiveClass}`
        }
      >
        <LayoutGrid size={20} />

        <span className="text-xs">Inicio</span>
      </NavLink>

      <NavLink
        to="/attendance"
        className={({ isActive }) =>
          `${baseClass} ${isActive ? activeClass : inactiveClass}`
        }
      >
        <CalendarDays size={20} />

        <span className="text-xs">Asistencia</span>
      </NavLink>

      <NavLink
        to="/subscriptions"
        className={({ isActive }) =>
          `${baseClass} ${isActive ? activeClass : inactiveClass}`
        }
      >
        <CreditCard size={20} />

        <span className="text-xs">Suscrip.</span>
      </NavLink>

      <NavLink
        to="/routines"
        className={({ isActive }) =>
          `${baseClass} ${isActive ? activeClass : inactiveClass}`
        }
      >
        <ClipboardList size={20} />

        <span className="text-xs">Rutinas</span>
      </NavLink>

      <NavLink
        to="/plans"
        className={({ isActive }) =>
          `${baseClass} ${isActive ? activeClass : inactiveClass}`
        }
      >
        <Dumbbell size={20} />

        <span className="text-xs">Planes</span>
      </NavLink>

      <NavLink
        to="/members"
        className={({ isActive }) =>
          `${baseClass} ${isActive ? activeClass : inactiveClass}`
        }
      >
        <Users size={20} />

        <span className="text-xs">Miembros</span>
      </NavLink>

      <NavLink
        to="/payments"
        className={({ isActive }) =>
          `${baseClass} ${isActive ? activeClass : inactiveClass}`
        }
      >
        <DollarSign size={20} />

        <span className="text-xs">Pagos</span>
      </NavLink>
    </nav>
  );
}

export default BottomNav;
