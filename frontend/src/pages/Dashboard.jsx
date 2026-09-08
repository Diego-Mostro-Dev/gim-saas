import StatsCards from "../components/dashboard/StatsCards";
import QuickActions from "../components/dashboard/QuickActions";
import WeeklyChart from "../components/dashboard/WeeklyChart";
import UpcomingExpirations from "../components/dashboard/UpcomingExpirations";
import PendingPayments from "../components/dashboard/PendingPayments";
import RecentActivity from "../components/dashboard/RecentActivity";

import { useDashboard } from "../hooks/useDashboard";
import { useClosedDates } from "../hooks/useClosedDates";
import ClosedDatesNotice from "../components/members/ClosedDatesNotice";

function Dashboard() {
  const { dashboardData, loading, error } = useDashboard();
  const { closedDates, error: closedDatesError } = useClosedDates();

  if (loading) {
    return <div className="text-text-primary">Cargando dashboard...</div>;
  }
  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-danger-bg dark:bg-danger/10 p-4 text-danger-text dark:text-danger">{error}</div>
      )}
      {closedDatesError && (
        <div className="rounded-xl bg-danger-bg dark:bg-danger/10 p-4 text-danger-text dark:text-danger">{closedDatesError}</div>
      )}
      <ClosedDatesNotice closedDates={closedDates} />
      <StatsCards data={dashboardData} />
      <QuickActions />
      <WeeklyChart data={dashboardData?.weeklyAttendance || []} />
      <UpcomingExpirations
        expirations={dashboardData?.upcomingExpirations || []}
      />
      <PendingPayments pendingPayments={dashboardData?.pendingPayments || []} />
      <RecentActivity activity={dashboardData?.recentActivity || []} />
    </div>
  );
}

export default Dashboard;
