import { useEffect, useState } from "react";

import TopBar from "../components/dashboard/TopBar";
import StatsCards from "../components/dashboard/StatsCards";
import QuickActions from "../components/dashboard/QuickActions";
import WeeklyChart from "../components/dashboard/WeeklyChart";
import UpcomingExpirations from "../components/dashboard/UpcomingExpirations";
import RecentActivity from "../components/dashboard/RecentActivity";
import BottomNav from "../components/dashboard/BottomNav";

import { getDashboardData } from "../services/dashboard.service";

function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await getDashboardData();

        setDashboardData(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

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
        <StatsCards data={dashboardData} />

        <QuickActions />

        <WeeklyChart />

        <UpcomingExpirations
  expirations={
    dashboardData?.upcomingExpirations || []
  }
/>

        <RecentActivity
  activity={dashboardData?.recentActivity || []}
/>

      </main>

      <BottomNav />
    </div>
  );
}

export default Dashboard;