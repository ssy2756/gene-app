"use client";

import { useState } from "react";
import type { DisplayReport } from "@/lib/report-mapping";
import { BackIcon } from "../Icons";

function BellIcon({ on }: { on: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={on ? "#3A2F88" : "none"}
      stroke={on ? "#3A2F88" : "#b8adc9"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0112 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" />
      <path d="M9.5 17a2.5 2.5 0 005 0" />
    </svg>
  );
}

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
  const [reminders, setReminders] = useState<Record<number, boolean>>({});
  const toggleReminder = (i: number) => setReminders((r) => ({ ...r, [i]: !r[i] }));

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
    <div className="pb-28" style={{ animation: "slideIn .22s ease" }}>
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
          {condition.checks.map((check, i) => {
            const on = !!reminders[i];
            return (
              <div key={i} className="flex items-center gap-3 card rounded-2xl bg-white p-3.5 shadow-[0_2px_8px_rgba(58,47,136,.05)]">
                <div className="flex-1 text-[13.5px] leading-relaxed text-[#2b2540]">{check.reason}</div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="whitespace-nowrap rounded-lg bg-[#f3eef9] px-2.5 py-1 text-[11px] font-semibold text-[#3A2F88]">
                    {check.cadence}
                  </span>
                  <button
                    onClick={() => toggleReminder(i)}
                    className="pressable flex items-center gap-1"
                  >
                    <BellIcon on={on} />
                    <span className="text-[10.5px] font-semibold" style={{ color: on ? "#3A2F88" : "#b8adc9" }}>
                      {on ? "Reminder on" : "Add reminder"}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
