import TopBar from "../components/dashboard/TopBar";
import StatsCards from "../components/dashboard/StatsCards";
import QuickActions from "../components/dashboard/QuickActions";
import WeeklyChart from "../components/dashboard/WeeklyChart";
import UpcomingExpirations from "../components/dashboard/UpcomingExpirations";
import RecentActivity from "../components/dashboard/RecentActivity";
import BottomNav from "../components/dashboard/BottomNav";

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
