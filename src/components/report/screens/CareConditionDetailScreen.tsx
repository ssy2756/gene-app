"use client";

import type { DisplayReport } from "@/lib/report-mapping";
import { BackIcon } from "../Icons";

export function CareConditionDetailScreen({
  report,
  conditionId,
  goBack,
}: {
  report: DisplayReport;
  conditionId: string | null;
  goBack: () => void;
}) {
  const condition = report.carePlan.find((c) => c.id === conditionId) ?? report.carePlan[0];

  if (!condition) {
    return (
      <div className="px-5 pt-3">
        <button onClick={goBack} className="flex items-center gap-1 text-sm font-semibold text-[#3A2F88]">
          <BackIcon /> Care plan
        </button>
        <div className="mt-6 text-center text-[13px] text-[#9a8fb0]">No care plan data available.</div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="px-5 pb-2 pt-3">
        <button onClick={goBack} className="flex items-center gap-1 text-sm font-semibold text-[#3A2F88]">
          <BackIcon /> Care plan
        </button>
      </div>

      <div className="px-5">
        <div
          className="mb-1 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: condition.bg, color: condition.text }}
        >
          {condition.name}
        </div>
        <div className="mt-1 text-[22px] font-bold tracking-tight">{condition.name}</div>
        <div className="mt-0.5 text-[12.5px] text-[#8a819c]">
          {condition.checks.length} thing{condition.checks.length === 1 ? "" : "s"} to monitor
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          {condition.checks.map((check, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-[0_2px_8px_rgba(58,47,136,.05)]">
              <div className="flex-1 text-[13.5px] leading-relaxed text-[#2b2540]">{check.reason}</div>
              <span className="whitespace-nowrap rounded-lg bg-[#f3eef9] px-2.5 py-1 text-[11px] font-semibold text-[#3A2F88]">
                {check.cadence}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
