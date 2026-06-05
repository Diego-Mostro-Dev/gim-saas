import StatsCards from "../components/dashboard/StatsCards";
import QuickActions from "../components/dashboard/QuickActions";
import WeeklyChart from "../components/dashboard/WeeklyChart";
import UpcomingExpirations from "../components/dashboard/UpcomingExpirations";
import PendingPayments from "../components/dashboard/PendingPayments";
import RecentActivity from "../components/dashboard/RecentActivity";

import { useDashboard } from "../hooks/useDashboard";

function Dashboard() {
  const { dashboardData, loading, error } = useDashboard();

  if (loading) {
    return <div className="text-white">Cargando dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-500/10 p-4 text-red-300">{error}</div>
      )}

      <StatsCards data={dashboardData} />

      <QuickActions />

      <WeeklyChart />

      <UpcomingExpirations
        expirations={dashboardData?.upcomingExpirations || []}
      />

      <PendingPayments pendingPayments={dashboardData?.pendingPayments || []} />

      <RecentActivity activity={dashboardData?.recentActivity || []} />
    </div>
  );
}

export default Dashboard;
