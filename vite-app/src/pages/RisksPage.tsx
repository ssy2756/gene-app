import { useState } from "react";
import { Link } from "react-router-dom";
import StatusBar from "../components/StatusBar";
import type { Condition } from "../lib/data";
import { useHighlight } from "../lib/highlight-context";
import { useReportData } from "../lib/report-context";

const RISK_COLOR: Record<string, string> = {
  low: "#2fa36b",
  mild: "#c9a227",
  moderate: "#d97b28",
  high: "#c0504a",
};
const RISK_BG: Record<string, string> = {
  low: "#e3f3ea",
  mild: "#fbf1d8",
  moderate: "#fbe7d6",
  high: "#f7e0de",
};
const RISK_TEXT: Record<string, string> = {
  low: "#1f7d54",
  mild: "#a67a12",
  moderate: "#b35c14",
  high: "#a13a34",
};
const RISK_LABEL: Record<string, string> = {
  low: "Low",
  mild: "Mild",
  moderate: "Moderate",
  high: "High",
};

export default function RisksPage() {
  const { riskFocusLevel } = useHighlight();
  const { conditions, riskGroupsBySystem, riskGroupsByLevel } = useReportData();
  const [groupBy, setGroupBy] = useState<"system" | "level">(riskFocusLevel ? "level" : "system");

  return (
    <div className="slide-in">
      <StatusBar />
      <div className="sticky top-0 z-10 px-5 pb-3 pt-1" style={{ background: "rgba(246,244,248,.9)", backdropFilter: "blur(10px)" }}>
        <div className="text-[22px] font-bold tracking-tight">Health risks</div>
        <div className="mt-0.5 text-[12.5px]" style={{ color: "#8a819c" }}>
          {conditions.length} conditions analyzed from your genome
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setGroupBy("system")}
            className="chip"
            style={{
              background: groupBy === "system" ? "#3A2F88" : "#fff",
              color: groupBy === "system" ? "#fff" : "#524a66",
              borderColor: groupBy === "system" ? "#3A2F88" : "#e7e0ef",
            }}
          >
            By body system
          </button>
          <button
            onClick={() => setGroupBy("level")}
            className="chip"
            style={{
              background: groupBy === "level" ? "#3A2F88" : "#fff",
              color: groupBy === "level" ? "#fff" : "#524a66",
              borderColor: groupBy === "level" ? "#3A2F88" : "#e7e0ef",
            }}
          >
            By risk level
          </button>
        </div>
      </div>

      <div className="px-5 pt-1">
        {groupBy === "system" &&
          riskGroupsBySystem.map((grp) => (
            <div key={grp.system} className="mb-[18px]">
              <div className="mb-[9px] flex items-center gap-2">
                <div
                  className="h-[27px] w-6 flex-none"
                  style={{
                    clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)",
                    background: grp.color,
                  }}
                />
                <span className="text-[13px] font-bold tracking-wide">{grp.system}</span>
              </div>
              <div className="flex flex-col gap-[9px]">
                {grp.items.map((c) => (
                  <ConditionRow key={c.id} c={c} showSystem={false} />
                ))}
              </div>
            </div>
          ))}

        {groupBy === "level" &&
          riskGroupsByLevel.map((grp) => (
            <div key={grp.key} className="relative mb-[18px]">
              {riskFocusLevel === grp.key && (
                <div
                  className="risk-focus pointer-events-none absolute inset-0"
                  style={{ "--focus-color": grp.color } as React.CSSProperties}
                />
              )}
              <div className="mb-[9px] flex items-center gap-2">
                <div className="h-[11px] w-[11px] flex-none rounded-full" style={{ background: grp.color }} />
                <span className="text-[13px] font-bold tracking-wide">{grp.label}</span>
                <span className="text-[11.5px]" style={{ color: "#9a8fb0" }}>
                  · {grp.count}
                </span>
              </div>
              <div className="flex flex-col gap-[9px]">
                {grp.items.map((c) => (
                  <ConditionRow key={c.id} c={c} showSystem={true} />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function ConditionRow({ c, showSystem }: { c: Condition; showSystem: boolean }) {
  return (
    <Link to={`/risks/${c.id}`} className="card flex items-center gap-3 px-[15px] py-3.5">
      <div className="flex-1">
        <div className="text-[14.5px] font-semibold">{c.name}</div>
        <div className="mt-0.5 text-[11.5px]" style={{ color: "#8a819c" }}>
          {showSystem ? `${c.system} · ${c.tag}` : c.tag}
        </div>
      </div>
      <div className="flex items-center gap-[9px]">
        <div className="relative h-[5px] w-[52px] overflow-hidden rounded-full" style={{ background: "#eee6f2" }}>
          <div
            className="grow-x absolute inset-y-0 left-0 rounded-full"
            style={{ width: c.gaugePct, background: RISK_COLOR[c.risk] }}
          />
        </div>
        <span className="pill" style={{ background: RISK_BG[c.risk], color: RISK_TEXT[c.risk] }}>
          {RISK_LABEL[c.risk]}
        </span>
      </div>
    </Link>
  );
}
