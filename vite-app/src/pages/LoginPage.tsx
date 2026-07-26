import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../components/Logo";

export default function LoginPage() {
  const navigate = useNavigate();
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
        credentials: "include",
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not find a report for this UID");
        return;
      }
      navigate("/", { replace: true });
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell flex flex-col items-center justify-center gap-8 p-6">
      <Logo />
      <div className="w-full max-w-sm rounded-2xl bg-white p-6" style={{ boxShadow: "0 2px 8px rgba(58,47,136,.05)" }}>
        <h1 className="text-xl font-semibold" style={{ color: "#2b2540" }}>
          Look up your report
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "#8a819c" }}>
          Enter the UID printed on page 1 of your genomic report, under your name.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <input
            type="text"
            placeholder="UID"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            required
            className="w-full rounded-xl border px-3.5 py-2.5 outline-none"
            style={{ borderColor: "#ece7f2", color: "#2b2540" }}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl px-3 py-2.5 font-semibold text-white disabled:opacity-50"
            style={{ background: "#3A2F88" }}
          >
            {loading ? "Looking up..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
