"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import type { DisplayReport } from "@/lib/report-mapping";
import { ReportApp } from "@/components/report/ReportApp";

export default function Home() {
  const [uid, setUid] = useState("");
  const [report, setReport] = useState<DisplayReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async (lookupUid: string) => {
    const res = await fetch(`/api/reports/${encodeURIComponent(lookupUid)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not find report");
      return;
    }
    setError(null);
    setReport(data);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await loadReport(uid);
    } finally {
      setLoading(false);
    }
  }

  if (report) {
    return <ReportApp report={report} onLogout={() => setReport(null)} onLoadUid={loadReport} />;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-[#f6f4f8] p-6">
      <Image src="/genepowerx-logo.svg" alt="GenepowerX" width={175} height={41} priority />
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-[#2b2540]">Look up your report</h1>
        <input
          type="text"
          placeholder="Enter your UID"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          required
          className="w-full rounded-xl border border-[#ece7f2] px-3.5 py-2.5 text-[#2b2540] outline-none focus:border-[#3A2F88]"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#3A2F88] px-3 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Looking up..." : "Look up"}
        </button>
      </form>
    </main>
  );
}
