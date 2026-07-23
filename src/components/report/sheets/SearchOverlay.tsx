"use client";

import { useMemo, useState } from "react";
import type { DisplayReport } from "@/lib/report-mapping";
import { GLOSSARY } from "@/lib/glossary";

type SearchResult = {
  key: string;
  title: string;
  sub: string;
  type: string;
  abbr: string;
  iconBg: string;
  iconColor: string;
  open: () => void;
};

const SUGGESTIONS = ["Hypertension", "Vitamin D", "Caffeine", "Diplotype"];

export function SearchOverlay({
  report,
  onClose,
  openDrug,
  openCondition,
  openDefine,
  goLifestyle,
}: {
  report: DisplayReport;
  onClose: () => void;
  openDrug: (id: string) => void;
  openCondition: (id: string) => void;
  openDefine: (term: string) => void;
  goLifestyle: () => void;
}) {
  const [query, setQuery] = useState("");

  const index: SearchResult[] = useMemo(() => {
    const drugResults = report.medications.map((d) => ({
      key: `${d.name} ${d.system} ${d.gene}`,
      title: d.name,
      sub: `${d.system} · ${d.gene}`,
      type: "Drug",
      abbr: d.name.slice(0, 2).toUpperCase(),
      iconBg: "#f3eef9",
      iconColor: "#4D3F9C",
      open: () => {
        onClose();
        openDrug(d.id);
      },
    }));
    const conditionResults = report.conditions.map((c) => ({
      key: `${c.name} ${c.system}`,
      title: c.name,
      sub: c.system,
      type: "Condition",
      abbr: c.name.slice(0, 2).toUpperCase(),
      iconBg: "#e8eef2",
      iconColor: "#4e92a8",
      open: () => {
        onClose();
        openCondition(c.id);
      },
    }));
    const vitaminResults = report.vitamins.flatMap((t) =>
      t.items.map((v) => ({
        key: `${v.name} vitamin nutrient`,
        title: v.name,
        sub: `Nutrient · ${v.dose}`,
        type: "Nutrient",
        abbr: v.name.slice(0, 2).toUpperCase(),
        iconBg: "#e3f3ea",
        iconColor: "#1f7d54",
        open: () => {
          onClose();
          goLifestyle();
        },
      }))
    );
    const termResults = Object.keys(GLOSSARY).map((t) => ({
      key: t,
      title: t,
      sub: "Definition",
      type: "Term",
      abbr: t.slice(0, 2).toUpperCase(),
      iconBg: "#fdefe4",
      iconColor: "#c0521a",
      open: () => {
        onClose();
        openDefine(t);
      },
    }));
    return [...drugResults, ...conditionResults, ...vitaminResults, ...termResults];
  }, [report, onClose, openDrug, openCondition, openDefine, goLifestyle]);

  const q = query.trim().toLowerCase();
  const results = q ? index.filter((r) => r.key.toLowerCase().includes(q)).slice(0, 12) : [];

  return (
    <div className="fixed inset-0 z-20 mx-auto flex max-w-md flex-col bg-[#f6f4f8]">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-[#ece7f2] bg-white px-3.5 py-2.5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drugs, conditions, terms…"
            className="w-full border-none bg-transparent text-sm text-[#2b2540] outline-none"
          />
        </div>
        <button onClick={onClose} className="text-sm font-semibold text-[#3A2F88]">
          Cancel
        </button>
      </div>

      <div className="hide-sb flex-1 overflow-y-auto px-4 pb-6">
        {q.length > 0 && (
          <>
            {results.map((r) => (
              <div
                key={r.key}
                onClick={r.open}
                className="mb-2.5 flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_2px_8px_rgba(58,47,136,.05)]"
              >
                <div
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] text-[11px] font-bold"
                  style={{ background: r.iconBg, color: r.iconColor }}
                >
                  {r.abbr}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{r.title}</div>
                  <div className="mt-0.5 text-[11.5px] text-[#8a819c]">{r.sub}</div>
                </div>
                <span className="rounded-md bg-[#f0ecf4] px-2 py-1 text-[10px] font-semibold text-[#8a819c]">
                  {r.type}
                </span>
              </div>
            ))}
            {results.length === 0 && (
              <div className="py-10 text-center text-[13px] text-[#9a8fb0]">Nothing found for &quot;{query}&quot;.</div>
            )}
          </>
        )}

        {q.length === 0 && (
          <>
            <div className="mb-2.5 mt-1.5 text-[11px] font-bold uppercase tracking-wide text-[#9a8fb0]">
              Try searching
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => {
                const hit = index.find((r) => r.title.toLowerCase() === s.toLowerCase());
                return (
                  <button
                    key={s}
                    onClick={() => (hit ? hit.open() : setQuery(s))}
                    className="chip rounded-full border border-[#e7e0ef] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#524a66]"
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
