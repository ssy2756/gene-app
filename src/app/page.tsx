"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DisplayReport } from "@/lib/report-mapping";
import { ReportApp } from "@/components/report/ReportApp";

export default function Home() {
  const router = useRouter();
  const [report, setReport] = useState<DisplayReport | null>(null);
  const [checking, setChecking] = useState(true);

  const loadMyReport = useCallback(async () => {
    const res = await fetch("/api/reports/me");
    if (!res.ok) {
      router.replace("/login");
      return;
    }
    return (await res.json()) as DisplayReport;
  }, [router]);

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
    router.replace("/login");
  }

  if (checking) {
    return <main className="mx-auto min-h-screen w-full max-w-md bg-[#f6f4f8]" />;
  }

  if (!report) {
    return null;
  }

  return <ReportApp report={report} onLogout={handleLogout} />;
}
