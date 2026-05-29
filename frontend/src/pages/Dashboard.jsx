import TopBar from "../components/dashboard/TopBar";
import StatsCards from "../components/dashboard/StatsCards";
import QuickActions from "../components/dashboard/QuickActions";
import WeeklyChart from "../components/dashboard/WeeklyChart";
import UpcomingExpirations from "../components/dashboard/UpcomingExpirations";
import RecentActivity from "../components/dashboard/RecentActivity";
import BottomNav from "../components/dashboard/BottomNav";
import { Link } from "react-router-dom";

import { useDashboard } from "../hooks/useDashboard";

function Dashboard() {
  const { dashboardData, loading, error } = useDashboard();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#131313] text-white">
        Cargando dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131313] pb-28 text-white">
      <TopBar />

      <main className="space-y-6 px-4 pt-20">
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <StatsCards data={dashboardData} />
        <Link
          to="/attendance"
          className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#201f1f] p-4 transition hover:border-blue-500/20"
        >
          <div>
            <p className="font-medium text-white">Asistencia semanal</p>

            <p className="text-sm text-zinc-400">Ver ocupación del gimnasio</p>
          </div>

          <span className="text-sm text-blue-300">Ver →</span>
        </Link>

        <QuickActions />

        <WeeklyChart />

        <UpcomingExpirations
          expirations={dashboardData?.upcomingExpirations || []}
        />

        <RecentActivity activity={dashboardData?.recentActivity || []} />
      </main>

      <BottomNav />
    </div>
  );
}

export default Dashboard;
