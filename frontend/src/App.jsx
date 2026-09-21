import { Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./layouts/AppLayout";
import ProtectedLayout from "./layouts/ProtectedLayout";
import AdminLayout from "./layouts/AdminLayout";
import AdminRoute from "./components/admin/AdminRoute";
import AdminGyms from "./pages/admin/AdminGyms";
import AdminGymEdit from "./pages/admin/AdminGymEdit";
import AdminGymWizard from "./pages/admin/AdminGymWizard";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import RecoverMembers from "./pages/RecoverMembers";
import Subscriptions from "./pages/Subscriptions";
import Plans from "./pages/Plans";
import Payments from "./pages/Payments";
import Attendance from "./pages/Attendance";
import Routines from "./pages/Routines";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Registration from "./pages/Registration";
import ChangePassword from "./pages/ChangePassword";
import Settings from "./pages/Settings";
import PersonalTrainingSettings from "./pages/PersonalTrainingSettings";
import MemberPortalLayout from "./pages/member/MemberPortalLayout";
import DashboardSelector from "./pages/member/DashboardSelector";
import MemberWorkout from "./pages/member/MemberWorkout";
import MemberPayments from "./pages/member/MemberPayments";
import MemberAttachments from "./pages/member/MemberAttachments";
import MemberRecoveries from "./pages/member/MemberRecoveries";
import MemberActivities from "./pages/MemberActivities";
import MemberData from "./pages/member/MemberData";
import MemberPersonalTraining from "./pages/MemberPersonalTraining";
import MemberCommunity from "./pages/member/MemberCommunity";
import CommunityPublicPage from "./pages/member/CommunityPublicPage";
import TrainerAgenda from "./pages/TrainerAgenda";
import PublicRoutine from "./pages/PublicRoutine";
import Checkin from "./pages/Checkin";
import AttendanceQR from "./pages/AttendanceQR";
import GymSetup from "./pages/onboarding/GymSetup";
import ScheduleChangeRequests from "./pages/ScheduleChangeRequests";
import ScheduleSwapRequests from "./pages/ScheduleSwapRequests";
import PlanChangeRequests from "./pages/PlanChangeRequests";
import AttendanceAnalytics from "./pages/AttendanceAnalytics";
import PersonalTrainingAttendance from "./pages/PersonalTrainingAttendance";
import Activities from "./pages/Activities";
import ActivitySchedules from "./pages/ActivitySchedules";
import ScheduleEnrollments from "./pages/ScheduleEnrollments";
import Staff from "./pages/Staff";
import NotFound from "./pages/NotFound";
import ProtectedFeature from "./features/ProtectedFeature";
import { useFeature } from "./features/FeatureProvider";
import useAuthStore from "./store/auth.store";

function HomeRedirect() {
  const isSuperuser = useAuthStore((state) => state.isSuperuser);
  const role = useAuthStore((state) => state.role);
  const personalTrainingEnabled = useFeature("personal_training");
  if (role === "professor") {
    return <Navigate to="/routines" replace />;
  }
  if (role === "trainer" && personalTrainingEnabled) {
    return <Navigate to="/trainer-agenda" replace />;
  }
  return <Navigate to={isSuperuser ? "/admin" : "/dashboard"} replace />;
}

function ProfessorRoute({ children }) {
  const role = useAuthStore((state) => state.role);
  if (role === "professor") {
    return <Navigate to="/routines" replace />;
  }
  if (role === "trainer") {
    return <Navigate to="/trainer-agenda" replace />;
  }
  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
      {/* redirect */}
      <Route path="/" element={<HomeRedirect />} />

      {/* public */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/register/:gymCode" element={<Register />} />
      <Route path="/routine/:token" element={<MemberPortalLayout />}>
        <Route index element={<DashboardSelector />} />
        <Route path="workout" element={<MemberWorkout />} />
        <Route path="payments" element={<MemberPayments />} />
        <Route path="recoveries" element={<MemberRecoveries />} />
        <Route path="attachments" element={<MemberAttachments />} />
        <Route path="activities" element={<MemberActivities />} />
        <Route path="data" element={<MemberData />} />
        <Route path="personal-training" element={<MemberPersonalTraining />} />
        <Route path="comunidad" element={<MemberCommunity />} />
        <Route path="schedules" element={<PublicRoutine />} />
      </Route>
      <Route path="/comunidad/:token" element={<CommunityPublicPage />} />
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
        <Route path="/dashboard" element={<ProfessorRoute><Dashboard /></ProfessorRoute>} />
        <Route path="/members" element={<ProfessorRoute><Members /></ProfessorRoute>} />
        <Route path="/recover-members" element={<ProfessorRoute><RecoverMembers /></ProfessorRoute>} />
        <Route path="/subscriptions" element={<ProfessorRoute><Subscriptions /></ProfessorRoute>} />
        <Route path="/plans" element={<ProfessorRoute><Plans /></ProfessorRoute>} />
        <Route path="/payments" element={<ProfessorRoute><Payments /></ProfessorRoute>} />
        <Route path="/attendance" element={<ProfessorRoute><Attendance /></ProfessorRoute>} />
        <Route path="/registration" element={<ProfessorRoute><Registration /></ProfessorRoute>} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/settings" element={<ProfessorRoute><Settings /></ProfessorRoute>} />
        <Route path="/personal-training" element={<ProfessorRoute><ProtectedFeature feature="personal_training"><PersonalTrainingSettings /></ProtectedFeature></ProfessorRoute>} />
        <Route path="/staff" element={<ProfessorRoute><Staff /></ProfessorRoute>} />
        <Route path="/trainer-agenda" element={<ProtectedFeature feature="personal_training"><TrainerAgenda /></ProtectedFeature>} />
        <Route path="/routines" element={<Routines />} />
        <Route path="/attendance-qr" element={<ProfessorRoute><AttendanceQR /></ProfessorRoute>} />
        <Route path="/schedule-change-requests" element={<ProfessorRoute><ScheduleChangeRequests /></ProfessorRoute>} />
        <Route path="/schedule-swap-requests" element={<ProfessorRoute><ScheduleSwapRequests /></ProfessorRoute>} />
        <Route path="/plan-change-requests" element={<ProfessorRoute><PlanChangeRequests /></ProfessorRoute>} />
        <Route path="/attendance-analytics" element={<ProfessorRoute><AttendanceAnalytics /></ProfessorRoute>} />
        <Route path="/personal-training-attendance" element={<ProfessorRoute><ProtectedFeature feature="personal_training"><PersonalTrainingAttendance /></ProtectedFeature></ProfessorRoute>} />
        <Route path="/activities" element={<ProfessorRoute><ProtectedFeature feature="activities"><Activities /></ProtectedFeature></ProfessorRoute>} />
        <Route path="/activities/:activityId/schedules" element={<ProfessorRoute><ProtectedFeature feature="activities"><ActivitySchedules /></ProtectedFeature></ProfessorRoute>} />
        <Route path="/activities/schedules/:scheduleId/enrollments" element={<ProfessorRoute><ProtectedFeature feature="activities"><ScheduleEnrollments /></ProtectedFeature></ProfessorRoute>} />
      </Route>

      {/* admin central (solo superuser) */}
      <Route
        element={
          <ProtectedLayout>
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          </ProtectedLayout>
        }
      >
        <Route path="/admin" element={<AdminGyms />} />
        <Route path="/admin/gyms/new" element={<AdminGymWizard />} />
        <Route path="/admin/gyms/:gymId" element={<AdminGymEdit />} />
      </Route>

      {/* catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </ErrorBoundary>
  );
}

export default App;
