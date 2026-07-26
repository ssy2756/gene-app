import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import StatusBar from "../components/StatusBar";
import { useReportData } from "../lib/report-context";

const STATUS_STYLE: Record<string, { bg: string; text: string; bar: string }> = {
  directed: { bg: "#e3f3ea", text: "#1f7d54", bar: "#2fa36b" },
  caution: { bg: "#fbf1d8", text: "#a67a12", bar: "#e0a93d" },
  adjust: { bg: "#fbe7d6", text: "#b35c14", bar: "#d97b28" },
};

const STATUS_LABEL: Record<string, string> = {
  directed: "Standard",
  caution: "Caution",
  adjust: "Adjust",
};

export default function MedicationsPage() {
  const { drugs, drugCategories } = useReportData();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const counts = useMemo(() => {
    const total = drugs.length;
    const directed = drugs.filter((d) => d.statusKey === "directed").length;
    const caution = drugs.filter((d) => d.statusKey === "caution").length;
    const adjust = drugs.filter((d) => d.statusKey === "adjust").length;
    const pct = (n: number) => Math.round((n / total) * 100);
    return {
      total,
      directedPct: pct(directed),
      cautionPct: pct(caution),
      adjustPct: pct(adjust),
    };
  }, [drugs]);

  const filtered = drugs.filter((d) => {
    const matchesCategory = category === "All" || d.category === category;
    const matchesQuery = d.name.toLowerCase().includes(query.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="slide-in">
      <StatusBar />
      <div
        className="sticky top-0 z-10 px-5 pb-3 pt-1"
        style={{ background: "rgba(246,244,248,.9)", backdropFilter: "blur(10px)" }}
      >
        <div className="text-[22px] font-bold tracking-tight">Medications</div>
        <div className="mt-0.5 text-[12.5px]" style={{ color: "#8a819c" }}>
          How your genes affect {counts.total} drugs
        </div>

        <div className="mt-3.5 flex h-3 overflow-hidden rounded-full" style={{ background: "#eee6f2" }}>
          <div style={{ width: `${counts.directedPct}%`, background: "#2fa36b" }} />
          <div style={{ width: `${counts.cautionPct}%`, background: "#e0a93d" }} />
          <div style={{ width: `${counts.adjustPct}%`, background: "#d97b28" }} />
        </div>
        <div className="mt-2 flex gap-3.5 text-[11px]" style={{ color: "#8a819c" }}>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-sm" style={{ background: "#2fa36b" }} />
            {counts.directedPct}% directed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-sm" style={{ background: "#e0a93d" }} />
            {counts.cautionPct}% caution
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-sm" style={{ background: "#d97b28" }} />
            {counts.adjustPct}% adjust
          </span>
        </div>

        <div
          className="mt-3 flex items-center gap-2.5 rounded-[13px] border bg-white px-3.5 py-2.5"
          style={{ borderColor: "#ece7f2" }}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6.5" stroke="#9a8fb0" strokeWidth="1.8" />
            <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="#9a8fb0" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a drug…"
            className="w-full border-none bg-transparent text-sm outline-none"
          />
        </div>

        <div className="hide-sb mt-3 -mx-5 flex gap-2 overflow-x-auto px-5">
          {["All", ...drugCategories].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="chip"
              style={{
                background: category === c ? "#3A2F88" : "#fff",
                color: category === c ? "#fff" : "#524a66",
                borderColor: category === c ? "#3A2F88" : "#e7e0ef",
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <Link
          to="/medications/diplotype"
          className="pressable mt-3 flex items-center gap-2.5 rounded-[14px] border bg-white px-3.5 py-3"
          style={{ borderColor: "#ded2ef" }}
        >
          <div
            className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px]"
            style={{ background: "#f3eef9" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M7 4c2 4 8 4 10 8M17 4c-2 4-8 4-10 8M7 20c2-4 8-4 10-8M17 20c-2-4-8-4-10-8"
                stroke="#3A2F88"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold">View diplotype panel</div>
            <div className="mt-px text-[11px]" style={{ color: "#8a819c" }}>
              Your raw gene test results
            </div>
          </div>
          <span style={{ color: "#c3b3e0" }}>›</span>
        </Link>
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-2">
        {filtered.map((d) => {
          const s = STATUS_STYLE[d.statusKey];
          return (
            <Link
              key={d.id}
              to={`/medications/${d.id}`}
              className="card relative flex items-center gap-3.5 px-4 py-3.5 pl-5"
            >
              <div
                className="absolute bottom-2 left-2.5 top-2 w-1 rounded-full"
                style={{ background: s.bar }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{d.name}</div>
                <div className="mt-0.5 text-[11.5px]" style={{ color: "#8a819c" }}>
                  {d.klass}
                </div>
              </div>
              <span className="pill whitespace-nowrap" style={{ background: s.bg, color: s.text }}>
                {STATUS_LABEL[d.statusKey]}
              </span>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm" style={{ color: "#9a8fb0" }}>
            No drugs match “{query}”.
          </div>
        )}
      </div>
    </div>
  );
}
