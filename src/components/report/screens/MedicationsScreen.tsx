"use client";

import { useMemo, useState } from "react";
import type { DisplayReport } from "@/lib/report-mapping";
import { ChevronRightIcon, SearchIcon } from "../Icons";

export function MedicationsScreen({
  report,
  openDrug,
  goDiplotype,
}: {
  report: DisplayReport;
  openDrug: (id: string) => void;
  goDiplotype: () => void;
}) {
  const { medications } = report;
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState("All");

  const systems = useMemo(
    () => ["All", ...Array.from(new Set(medications.map((d) => d.system)))],
    [medications]
  );

  const filtered = medications.filter(
    (d) =>
      (system === "All" || d.system === system) &&
      (!query || d.name.toLowerCase().includes(query.toLowerCase()) || d.gene.toLowerCase().includes(query.toLowerCase()))
  );

  const total = medications.length;
  const cautionCount = medications.filter((d) => d.statusKey === "caution").length;
  const adjustCount = medications.filter((d) => d.statusKey === "adjust").length;
  const directedCount = total - cautionCount - adjustCount;
  const directedPct = total ? Math.round((directedCount / total) * 100) : 0;
  const cautionPct = total ? Math.round((cautionCount / total) * 100) : 0;
  const adjustPct = total ? Math.max(0, 100 - directedPct - cautionPct) : 0;

  return (
    <div className="pb-28">
      <div className="px-5 pb-3 pt-3">
        <div className="text-[22px] font-bold tracking-tight">Medications</div>
        <div className="mt-0.5 text-[12.5px] text-[#8a819c]">How your genes affect {medications.length} drugs</div>

        {medications.length > 0 && (
          <>
            <div className="mt-3.5 flex h-3 overflow-hidden rounded-md bg-[#eee6f2]">
              <div className="h-full bg-[#2fa36b]" style={{ width: `${directedPct}%` }} />
              <div className="h-full bg-[#e0a93d]" style={{ width: `${cautionPct}%` }} />
              <div className="h-full bg-[#d97b28]" style={{ width: `${adjustPct}%` }} />
            </div>
            <div className="mt-2.5 flex gap-3.5 text-[11px] text-[#8a819c]">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-sm bg-[#2fa36b]" />
                {directedPct}% directed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-sm bg-[#e0a93d]" />
                {cautionPct}% caution
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-sm bg-[#d97b28]" />
                {adjustPct}% adjust
              </span>
            </div>
          </>
        )}

        <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-[#ece7f2] bg-white px-3.5 py-2.5">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a drug…"
            className="w-full border-none bg-transparent text-sm text-[#2b2540] outline-none"
          />
        </div>

        <div className="hide-sb mt-3 -mx-5 flex gap-2 overflow-x-auto px-5">
          {systems.map((s) => (
            <button
              key={s}
              onClick={() => setSystem(s)}
              className="chip whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold"
              style={{
                background: system === s ? "#3A2F88" : "#fff",
                color: system === s ? "#fff" : "#524a66",
                borderColor: system === s ? "#3A2F88" : "#e7e0ef",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={goDiplotype}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-[#ded2ef] bg-white px-4 py-3 text-left"
        >
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold">View diplotype panel</div>
            <div className="mt-0.5 text-[11px] text-[#8a819c]">Your raw gene test results</div>
          </div>
          <ChevronRightIcon />
        </button>
      </div>

      <div className="flex flex-col gap-2.5 px-5">
        {filtered.map((d) => (
          <div
            key={d.id}
            onClick={() => openDrug(d.id)}
            className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_2px_8px_rgba(58,47,136,.05)]"
          >
            <div className="h-full w-1 flex-none self-stretch rounded" style={{ background: d.color }} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{d.name}</div>
              <div className="mt-0.5 text-[11.5px] text-[#8a819c]">{d.klass}</div>
            </div>
            <span
              className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: d.pillBg, color: d.pillText }}
            >
              {d.short}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-10 text-center text-[13px] text-[#9a8fb0]">No drugs match “{query}”.</div>
        )}
      </div>
    </div>
  );
}
