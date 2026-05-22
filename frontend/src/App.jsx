import { Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/dashboard" />}
      />

      <Route
        path="/dashboard"
        element={<Dashboard />}
      />

      <Route
        path="/members"
        element={<Members />}
      />
    </Routes>
  );
}

export default App;