import { Outlet } from "react-router-dom";

import TopBar from "../components/dashboard/TopBar";
import BottomNav from "../components/dashboard/BottomNav";
import { useScheduleChangeWatcher } from "../hooks/useScheduleChangeWatcher";
import { useScheduleSwapWatcher } from "../hooks/useScheduleSwapWatcher";
import { usePlanChangeWatcher } from "../hooks/usePlanChangeWatcher";

export default function AppLayout() {
  useScheduleChangeWatcher();
  useScheduleSwapWatcher();
  usePlanChangeWatcher();
  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <TopBar />

      <main className="px-4 pt-20 pb-28">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
