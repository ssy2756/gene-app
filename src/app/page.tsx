"use client";

import { useState } from "react";
import type { DisplayReport } from "@/lib/report-mapping";

export default function Home() {
  const [uid, setUid] = useState("");
  const [report, setReport] = useState<DisplayReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReport(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(uid)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not find report");
        return;
      }
      setReport(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Look up your report</h1>
        <input
          type="text"
          placeholder="Enter your UID"
          value={uid}
          onChange={(e) => setUid(e.target.value)}
          required
          className="w-full rounded border px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Looking up..." : "Look up"}
        </button>
      </form>

      {/*
        TODO: once the UI asset folder is provided, replace this raw JSON
        dump with the real generated .tsx components mapped to the
        specific fields those screens need.
      */}
      {report && (
        <pre className="w-full max-w-2xl overflow-auto rounded border bg-gray-50 p-4 text-xs">
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </main>
  );
}
