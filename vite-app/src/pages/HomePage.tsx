import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DisplayReport } from "@/lib/report-mapping";
import { ReportApp } from "@/components/report/ReportApp";

export default function HomePage() {
  const navigate = useNavigate();
  const [report, setReport] = useState<DisplayReport | null>(null);
  const [checking, setChecking] = useState(true);

  const loadMyReport = useCallback(async () => {
    const res = await fetch("/api/reports/me");
    if (!res.ok) {
      navigate("/login", { replace: true });
      return;
    }
    return (await res.json()) as DisplayReport;
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const data = await loadMyReport();
      if (cancelled) return;
      if (data) setReport(data);
      setChecking(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [loadMyReport]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    navigate("/login", { replace: true });
  }

  if (checking) {
    return <main className="mx-auto min-h-screen w-full max-w-md bg-[#f6f4f8]" />;
  }

  if (!report) {
    return null;
  }

  return <ReportApp report={report} onLogout={handleLogout} />;
}
