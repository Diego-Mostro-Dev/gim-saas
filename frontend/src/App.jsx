import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import ProtectedLayout from "./layouts/ProtectedLayout";

import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Subscriptions from "./pages/Subscriptions";
import Plans from "./pages/Plans";
import Payments from "./pages/Payments";
import Attendance from "./pages/Attendance";

import Register from "./pages/Register";
import Login from "./pages/Login";
import Registration from "./pages/Registration";
import ChangePassword from "./pages/ChangePassword";
import Settings from "./pages/Settings";

function App() {
  return (
    <Routes>
      {/* redirect */}
      <Route path="/" element={<Navigate to="/dashboard" />} />

      {/* public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register/:gymCode" element={<Register />} />

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
      </Route>
    </Routes>
  );
}

export default App;
