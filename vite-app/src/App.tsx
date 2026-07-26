import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import type { DisplayReport } from "./lib/report-mapping";
import { ReportDataProvider } from "./lib/report-context";
import { HighlightProvider } from "./lib/highlight-context";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import TabBar from "./components/TabBar";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import RisksPage from "./pages/RisksPage";
import ConditionDetailPage from "./pages/ConditionDetailPage";
import LifestylePage from "./pages/LifestylePage";
import MedicationsPage from "./pages/MedicationsPage";
import DrugDetailPage from "./pages/DrugDetailPage";
import DiplotypePanelPage from "./pages/DiplotypePanelPage";
import CarePlanPage from "./pages/CarePlanPage";
import ProfilePage from "./pages/ProfilePage";
import SearchPage from "./pages/SearchPage";

function AuthedShell({ report }: { report: DisplayReport }) {
  const location = useLocation();
  const hideTabs = location.pathname === "/search";
  return (
    <ReportDataProvider report={report}>
      <HighlightProvider>
        <div className="app-shell">
          <div className="screen" style={hideTabs ? { paddingBottom: 0 } : undefined}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/risks" element={<RisksPage />} />
              <Route path="/risks/:id" element={<ConditionDetailPage />} />
              <Route path="/lifestyle" element={<LifestylePage />} />
              <Route path="/medications" element={<MedicationsPage />} />
              <Route path="/medications/:id" element={<DrugDetailPage />} />
              <Route path="/medications/diplotype" element={<DiplotypePanelPage />} />
              <Route path="/care" element={<CarePlanPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/search" element={<SearchPage />} />
            </Routes>
          </div>
          {!hideTabs && <TabBar />}
        </div>
      </HighlightProvider>
    </ReportDataProvider>
  );
}

function Root() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<"checking" | "authed" | "anon">("checking");
  const [report, setReport] = useState<DisplayReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/me", { credentials: "include" })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setStatus("anon");
          return;
        }
        setReport((await res.json()) as DisplayReport);
        setStatus("authed");
      })
      .catch(() => !cancelled && setStatus("anon"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status === "anon" && location.pathname !== "/login") {
      navigate("/login", { replace: true });
    }
  }, [status, location.pathname, navigate]);

  if (status === "checking") {
    return <div className="app-shell" />;
  }

  if (status === "anon" || !report) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={null} />
      </Routes>
    );
  }

  return <AuthedShell report={report} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ServiceWorkerRegister />
      <Root />
    </BrowserRouter>
  );
}
