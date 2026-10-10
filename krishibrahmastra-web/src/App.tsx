import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ScanPage } from "./pages/ScanPage";
import { ResultPage } from "./pages/ResultPage";
import { BRCFinderPage } from "./pages/BRCFinderPage";
import { HistoryPage } from "./pages/HistoryPage";
import { AdminPage } from "./pages/AdminPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AppShell } from "./components/AppShell";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected — all wrapped in AppShell which handles auth guard */}
        <Route element={<AppShell />}>
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/results/:id" element={<ResultPage />} />
          <Route path="/brc-finder" element={<BRCFinderPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        {/* Catch-all → scan (AppShell will redirect to /login if not authed) */}
        <Route path="*" element={<Navigate to="/scan" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
