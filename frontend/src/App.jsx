import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import ProtectedLayout from "./layouts/ProtectedLayout";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Subscriptions from "./pages/Subscriptions";
import Plans from "./pages/Plans";
import Payments from "./pages/Payments";
import Attendance from "./pages/Attendance";
import Routines from "./pages/Routines";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Registration from "./pages/Registration";
import ChangePassword from "./pages/ChangePassword";
import Settings from "./pages/Settings";
import MemberPortalLayout from "./pages/member/MemberPortalLayout";
import MemberDashboard from "./pages/member/MemberDashboard";
import MemberWorkout from "./pages/member/MemberWorkout";
import MemberPayments from "./pages/member/MemberPayments";
import PublicRoutine from "./pages/PublicRoutine";
import Checkin from "./pages/Checkin";
import AttendanceQR from "./pages/AttendanceQR";
import GymSetup from "./pages/onboarding/GymSetup";
import ScheduleChangeRequests from "./pages/ScheduleChangeRequests";
import ScheduleSwapRequests from "./pages/ScheduleSwapRequests";
import AttendanceAnalytics from "./pages/AttendanceAnalytics";

function App() {
  return (
    <Routes>
      {/* redirect */}
      <Route path="/" element={<Navigate to="/dashboard" />} />

      {/* public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register/:gymCode" element={<Register />} />
      <Route path="/routine/:token" element={<MemberPortalLayout />}>
        <Route index element={<MemberDashboard />} />
        <Route path="workout" element={<MemberWorkout />} />
        <Route path="payments" element={<MemberPayments />} />
        <Route path="schedules" element={<PublicRoutine />} />
      </Route>
      <Route path="/checkin/:gymCode" element={<Checkin />} />
      <Route path="/onboarding/:gymCode" element={<GymSetup />} />

      {/* protected layout */}
      <Route
        element={
          <ProtectedLayout>
            <AppLayout />
          </ProtectedLayout>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/members" element={<Members />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/registration" element={<Registration />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/routines" element={<Routines />} />
        <Route path="/attendance-qr" element={<AttendanceQR />} />
        <Route path="/schedule-change-requests" element={<ScheduleChangeRequests />} />
        <Route path="/schedule-swap-requests" element={<ScheduleSwapRequests />} />
        <Route path="/attendance-analytics" element={<AttendanceAnalytics />} />
      </Route>
    </Routes>
  );
}

export default App;
