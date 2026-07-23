"use client";

import { useMemo, useState } from "react";
import type { DisplayReport } from "@/lib/report-mapping";

export function HealthRisksScreen({
  report,
  openCondition,
}: {
  report: DisplayReport;
  openCondition: (id: string) => void;
}) {
  const [groupBy, setGroupBy] = useState<"system" | "risk">("system");
  const { conditions } = report;

  const SYSTEM_COLORS: Record<string, string> = {
    Cardiovascular: "#4e92a8",
    Endocrine: "#e0a93d",
    Neurological: "#4D3F9C",
    Ophthalmic: "#29b6e8",
  };

  const groupsBySystem = useMemo(() => {
    const map = new Map<string, typeof conditions>();
    for (const c of conditions) {
      const list = map.get(c.system) ?? [];
      list.push(c);
      map.set(c.system, list);
    }
    return [...map.entries()];
  }, [conditions]);

  const groupsByRisk = useMemo(() => {
    const order: (typeof conditions[number]["riskKey"])[] = ["high", "moderate", "mild", "low", "unknown"];
    return order
      .map((key) => ({ key, items: conditions.filter((c) => c.riskKey === key) }))
      .filter((g) => g.items.length > 0);
  }, [conditions]);

  return (
    <div className="pb-28">
      <div className="px-5 pb-3 pt-3">
        <div className="text-[22px] font-bold tracking-tight">Health risks</div>
        <div className="mt-0.5 text-[12.5px] text-[#8a819c]">
          {groupBy === "system" ? "Grouped by body system" : "Grouped by risk level"}
        </div>
        <div className="mt-3 flex gap-2">
          {(["system", "risk"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className="chip rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold"
              style={{
                background: groupBy === g ? "#3A2F88" : "#fff",
                color: groupBy === g ? "#fff" : "#524a66",
                borderColor: groupBy === g ? "#3A2F88" : "#e7e0ef",
              }}
            >
              {g === "system" ? "By body system" : "By risk level"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">
        {conditions.length === 0 && (
          <div className="py-10 text-center text-[13px] text-[#9a8fb0]">No conditions found in this report.</div>
        )}

        {groupBy === "system" &&
          groupsBySystem.map(([system, items]) => (
            <div key={system} className="mb-4.5">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-[27px] w-6 flex-none"
                  style={{
                    background: SYSTEM_COLORS[system] ?? "#8a819c",
                    clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)",
                  }}
                />
                <span className="text-[13px] font-bold tracking-wide">{system}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((c) => (
                  <ConditionRow key={c.id} c={c} onClick={() => openCondition(c.id)} />
                ))}
              </div>
            </div>
          ))}

        {groupBy === "risk" &&
          groupsByRisk.map((g) => (
            <div key={g.key} className="mb-4.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: g.items[0].color }} />
                <span className="text-[13px] font-bold">{g.items[0].riskLabel}</span>
                <span className="text-[11.5px] text-[#9a8fb0]">· {g.items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {g.items.map((c) => (
                  <ConditionRow key={c.id} c={c} onClick={() => openCondition(c.id)} showSystem />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function ConditionRow({
  c,
  onClick,
  showSystem,
}: {
  c: DisplayReport["conditions"][number];
  onClick: () => void;
  showSystem?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_2px_8px_rgba(58,47,136,.05)]"
    >
      <div className="flex-1">
        <div className="text-[14.5px] font-semibold">{c.name}</div>
        <div className="mt-0.5 text-[11.5px] text-[#8a819c]">
          {showSystem ? `${c.system}${c.tag ? " · " + c.tag : ""}` : c.tag}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="relative flex-none overflow-hidden rounded"
          style={{ width: 52, height: 5, background: "#eee6f2" }}
        >
          <div className="absolute inset-y-0 left-0 rounded" style={{ width: c.gaugePct, background: c.color }} />
        </div>
        <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: c.bg, color: c.text }}>
          {c.riskLabel}
        </span>
      </div>
    </div>
  );
}
