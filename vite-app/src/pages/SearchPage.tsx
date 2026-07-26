import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useReportData } from "../lib/report-context";

interface Result {
  key: string;
  title: string;
  sub: string;
  type: string;
  abbr: string;
  iconBg: string;
  iconColor: string;
  to: string;
}

const SUGGESTIONS = ["Clopidogrel", "Statins", "Hypertension", "Vitamin D", "Migraine", "Warfarin"];

export default function SearchPage() {
  const navigate = useNavigate();
  const { drugs, conditions, vitTiers } = useReportData();
  const [query, setQuery] = useState("");

  const index: Result[] = useMemo(() => {
    const drugResults: Result[] = drugs.map((d) => ({
      key: `${d.name} ${d.gene} ${d.category} ${d.klass}`.toLowerCase(),
      title: d.name,
      sub: `${d.category} · ${d.gene}`,
      type: "Drug",
      abbr: d.name.slice(0, 2).toUpperCase(),
      iconBg: "#f3eef9",
      iconColor: "#4D3F9C",
      to: `/medications/${d.id}`,
    }));
    const conditionResults: Result[] = conditions.map((c) => ({
      key: `${c.name} ${c.system} ${c.tag}`.toLowerCase(),
      title: c.name,
      sub: c.system,
      type: "Condition",
      abbr: c.name.slice(0, 2).toUpperCase(),
      iconBg: "#e8eef2",
      iconColor: "#4e92a8",
      to: `/risks/${c.id}`,
    }));
    const nutrients: Result[] = vitTiers.flatMap((t) => t.items).map((v) => ({
      key: `${v.name} nutrient vitamin`.toLowerCase(),
      title: v.name,
      sub: `Nutrient · ${v.dose}`,
      type: "Nutrient",
      abbr: v.name.slice(0, 2).toUpperCase(),
      iconBg: "#e3f3ea",
      iconColor: "#1f7d54",
      to: "/lifestyle",
    }));
    return [...drugResults, ...conditionResults, ...nutrients];
  }, [drugs, conditions, vitTiers]);

  const trimmed = query.trim().toLowerCase();
  const results = trimmed ? index.filter((r) => r.key.includes(trimmed)).slice(0, 20) : [];

  return (
    <div className="rise-in flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div
          className="flex flex-1 items-center gap-2.5 rounded-[13px] border bg-white px-3.5 py-2.5"
          style={{ borderColor: "#ece7f2" }}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6.5" stroke="#9a8fb0" strokeWidth="1.8" />
            <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="#9a8fb0" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drugs, conditions, nutrients…"
            className="w-full border-none bg-transparent text-sm outline-none"
          />
        </div>
        <button
          onClick={() => navigate(-1)}
          className="text-sm font-semibold"
          style={{ color: "#3A2F88" }}
        >
          Cancel
        </button>
      </div>

      <div className="hide-sb flex-1 overflow-y-auto px-4 pb-5">
        {trimmed ? (
          results.length ? (
            results.map((r) => (
              <Link
                key={r.key + r.title}
                to={r.to}
                className="card mb-2.5 flex items-center gap-3 px-[15px] py-3.5"
              >
                <div
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] text-[11px] font-bold"
                  style={{ background: r.iconBg, color: r.iconColor }}
                >
                  {r.abbr}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{r.title}</div>
                  <div className="mt-px text-[11.5px]" style={{ color: "#8a819c" }}>
                    {r.sub}
                  </div>
                </div>
                <span
                  className="rounded-md px-2 py-1 text-[10px] font-semibold"
                  style={{ background: "#f0ecf4", color: "#8a819c" }}
                >
                  {r.type}
                </span>
              </Link>
            ))
          ) : (
            <div className="py-10 text-center text-sm" style={{ color: "#9a8fb0" }}>
              Nothing found for “{query}”.
            </div>
          )
        ) : (
          <>
            <div
              className="mb-2.5 mt-1.5 px-1 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: "#9a8fb0" }}
            >
              Try searching
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="chip border"
                  style={{ background: "#fff", borderColor: "#e7e0ef", color: "#524a66" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
