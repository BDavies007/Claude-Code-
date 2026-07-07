import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGate } from "./components/AuthGate";
import { Layout } from "./components/Layout";
import { MorningBrief } from "./pages/MorningBrief";
import { Dashboard } from "./pages/Dashboard";
import { Health } from "./pages/Health";
import { InboxPage } from "./pages/Inbox";
import { CalendarPage } from "./pages/Calendar";
import { Finance } from "./pages/Finance";
import { CRM } from "./pages/CRM";
import { Leads } from "./pages/Leads";
import { Projects } from "./pages/Projects";
import { SettingsPage } from "./pages/Settings";

export default function App() {
  return (
    <AuthGate>
      {(lock) => (
        <Layout onLock={lock}>
          <Routes>
            <Route path="/" element={<MorningBrief />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/health" element={<Health />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/crm" element={<CRM />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
    </AuthGate>
  );
}
