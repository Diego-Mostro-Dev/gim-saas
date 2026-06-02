import { Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Subscriptions from "./pages/Subscriptions";
import Plans from "./pages/Plans";
import Payments from "./pages/Payments";
import Attendance from "./pages/Attendance";
import Register from "./pages/Register";
import Login from "./pages/Login";

import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      {/* Redirección inicial */}
      <Route path="/" element={<Navigate to="/dashboard" />} />

      {/* Públicas */}
      <Route path="/login" element={<Login />} />

      <Route path="/register" element={<Register />} />

      {/* Protegidas */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/members"
        element={
          <ProtectedRoute>
            <Members />
          </ProtectedRoute>
        }
      />

      <Route
        path="/subscriptions"
        element={
          <ProtectedRoute>
            <Subscriptions />
          </ProtectedRoute>
        }
      />

      <Route
        path="/plans"
        element={
          <ProtectedRoute>
            <Plans />
          </ProtectedRoute>
        }
      />

      <Route
        path="/payments"
        element={
          <ProtectedRoute>
            <Payments />
          </ProtectedRoute>
        }
      />

      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <Attendance />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
