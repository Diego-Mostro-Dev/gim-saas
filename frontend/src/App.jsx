import { Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Subscriptions from "./pages/Subscriptions";
import Plans from "./pages/Plans";
import Payments from "./pages/Payments";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" />} />

      <Route path="/dashboard" element={<Dashboard />} />

      <Route path="/members" element={<Members />} />
      <Route path="/subscriptions" element={<Subscriptions />} />
      <Route path="/plans" element={<Plans />} />
      <Route path="/payments" element={<Payments />} />
    </Routes>
  );
}

export default App;
