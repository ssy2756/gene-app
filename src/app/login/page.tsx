"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not find a report for this UID");
        return;
      }
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-8 bg-[#f6f4f8] p-6">
      <Image src="/genepowerx-logo.svg" alt="GenepowerX" width={175} height={41} priority />
      <div className="w-full rounded-2xl bg-white p-6 shadow-[0_2px_8px_rgba(58,47,136,.05)]">
        <h1 className="text-xl font-semibold text-[#2b2540]">Look up your report</h1>
        <p className="mt-1 text-[13px] text-[#8a819c]">
          Enter the UID printed on page 1 of your genomic report, under your name.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <input
            type="text"
            placeholder="UID"
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
            {loading ? "Looking up..." : "Log in"}
          </button>
        </form>
      </div>
    </main>
  );
}
