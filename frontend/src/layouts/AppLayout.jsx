import { Outlet } from "react-router-dom";

import TopBar from "../components/dashboard/TopBar";
import BottomNav from "../components/dashboard/BottomNav";
import { useScheduleChangeWatcher } from "../hooks/useScheduleChangeWatcher";

export default function AppLayout() {
  useScheduleChangeWatcher();
  return (
    <div className="min-h-screen bg-[#131313] text-white">
      <TopBar />

      {/* contenido real de páginas */}
      <main className="px-4 pt-20 pb-28">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
