import {
  LayoutGrid,
  CreditCard,
  Users,
  DollarSign,
  Dumbbell,
  CalendarDays,
  ClipboardList,
  ArrowLeftRight,
  Repeat,
  BarChart3,
} from "lucide-react";

import { NavLink } from "react-router-dom";

import { useScheduleChangeData } from "../../hooks/useScheduleChangeData";
import { useScheduleSwapData } from "../../hooks/useScheduleSwapData";

function BottomNav() {
  const { pendingCount } = useScheduleChangeData();
  const { pendingCount: swapPendingCount } = useScheduleSwapData();

  const baseClass = "flex flex-col items-center px-2 py-2 transition";

  const activeClass = "rounded-xl bg-info-bg text-info-text dark:bg-info/15 dark:text-info";

  const inactiveClass = "text-text-secondary";

  const cambiosBlueClass = pendingCount > 0 ? "text-info-text dark:text-info" : "";

  return (
    <nav className="fixed bottom-0 z-50 flex h-20 w-full items-center justify-around gap-1 overflow-x-auto border-t border-border/10 bg-surface-elevated px-2">
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
        to="/attendance-analytics"
        className={({ isActive }) =>
          `${baseClass} ${isActive ? activeClass : inactiveClass}`
        }
      >
        <BarChart3 size={20} />

        <span className="text-xs">Métricas</span>
      </NavLink>

      <NavLink
        to="/schedule-change-requests"
        className={({ isActive }) =>
          `${baseClass} ${isActive ? activeClass : inactiveClass}`
        }
      >
        <span className="relative">
          <ArrowLeftRight size={20} className={cambiosBlueClass} />

          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold leading-none text-white">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </span>

        <span className={`text-xs ${cambiosBlueClass}`}>Cambios permanentes</span>
      </NavLink>

      <NavLink
        to="/schedule-swap-requests"
        className={({ isActive }) =>
          `${baseClass} ${isActive ? activeClass : inactiveClass}`
        }
      >
        <span className="relative">
          <Repeat size={20} className={swapPendingCount > 0 ? "text-info-text dark:text-info" : ""} />

          {swapPendingCount > 0 && (
            <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold leading-none text-white">
              {swapPendingCount > 99 ? "99+" : swapPendingCount}
            </span>
          )}
        </span>

        <span className={`text-xs ${swapPendingCount > 0 ? "text-info-text dark:text-info" : ""}`}>
          Intercambios
        </span>
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
        to="/plan-change-requests"
        className={({ isActive }) =>
          `${baseClass} ${isActive ? activeClass : inactiveClass}`
        }
      >
        <span className="relative">
          <ArrowLeftRight size={20} />
        </span>

        <span className="text-xs">Cambios de plan</span>
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
