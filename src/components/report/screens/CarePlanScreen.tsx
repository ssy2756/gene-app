"use client";

import { useMemo, useState } from "react";
import type { DisplayReport } from "@/lib/report-mapping";

export function CarePlanScreen({ report }: { report: DisplayReport }) {
  const { carePlan } = report;
  const [filter, setFilter] = useState("All");

  const cadences = useMemo(() => ["All", ...Array.from(new Set(carePlan.map((a) => a.cadence)))], [carePlan]);
  const filtered = carePlan.filter((a) => filter === "All" || a.cadence === filter);

  return (
    <div className="pb-28">
      <div className="px-5 pb-2 pt-3">
        <div className="text-[22px] font-bold tracking-tight">Care plan</div>
        <div className="mt-0.5 text-[12.5px] text-[#8a819c]">Monitoring &amp; follow-ups, all in one place</div>
      </div>

      <div className="hide-sb -mx-0 mb-2 flex gap-2 overflow-x-auto px-5">
        {cadences.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="chip whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold"
            style={{
              background: filter === f ? "#3A2F88" : "#fff",
              color: filter === f ? "#fff" : "#524a66",
              borderColor: filter === f ? "#3A2F88" : "#e7e0ef",
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-2">
        {filtered.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_2px_8px_rgba(58,47,136,.05)]">
            <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-[#f3eef9] text-xs font-bold text-[#3A2F88]">
              {a.badge}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{a.label}</div>
              <div className="mt-0.5 text-[11.5px] text-[#8a819c]">{a.reason}</div>
            </div>
            <span className="whitespace-nowrap rounded-lg bg-[#f3eef9] px-2.5 py-1 text-[11px] font-semibold text-[#3A2F88]">
              {a.cadence}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-10 text-center text-[13px] text-[#9a8fb0]">No items in this frequency.</div>
        )}
      </div>
    </div>
  );
}
