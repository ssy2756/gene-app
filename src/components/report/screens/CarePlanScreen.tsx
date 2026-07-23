"use client";

import { useState } from "react";
import type { DisplayReport } from "@/lib/report-mapping";

// Reminder bell — ported verbatim (paths, colors, sizing) from the mockup's
// care-plan row (`a.bellFill`/`a.bellStroke`/`a.reminderLabel`), applied here
// per-condition since this screen groups checks by condition.
function BellIcon({ on }: { on: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={on ? "#3A2F88" : "none"}
      stroke={on ? "#3A2F88" : "#b8adc9"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0112 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" />
      <path d="M9.5 17a2.5 2.5 0 005 0" />
    </svg>
  );
}

export function CarePlanScreen({
  report,
  openCondition,
}: {
  report: DisplayReport;
  openCondition: (id: string) => void;
}) {
  const { carePlan } = report;
  const [reminders, setReminders] = useState<Record<string, boolean>>({});
  const toggleReminder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setReminders((r) => ({ ...r, [id]: !r[id] }));
  };

  return (
    <div className="pb-28" style={{ animation: "slideIn .25s ease" }}>
      <div className="px-5 pb-2 pt-3">
        <div className="text-[22px] font-bold tracking-tight">Care plan</div>
        <div className="mt-0.5 text-[12.5px] text-[#8a819c]">Monitoring &amp; follow-ups, by condition</div>
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-2">
        {carePlan.map((c) => {
          const on = !!reminders[c.id];
          return (
            <div
              key={c.id}
              onClick={() => openCondition(c.id)}
              className="card flex w-full cursor-pointer items-center gap-[13px] rounded-2xl bg-white text-left shadow-[0_2px_8px_rgba(58,47,136,.05)]"
              style={{ padding: "14px 15px" }}
            >
              <div
                className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] text-xs font-bold"
                style={{ background: c.bg, color: c.text }}
              >
                {c.badge}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="mt-0.5 text-[11.5px] text-[#8a819c]">
                  {c.checks.length} check{c.checks.length === 1 ? "" : "s"} to monitor
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span
                  className="whitespace-nowrap rounded-lg bg-[#f3eef9] px-2.5 py-1 text-[11px] font-semibold text-[#3A2F88]"
                  style={{ borderRadius: 8 }}
                >
                  {c.checks[0]?.cadence ?? "As advised"}
                </span>
                <button
                  onClick={(e) => toggleReminder(c.id, e)}
                  className="pressable flex cursor-pointer items-center gap-1"
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
        {carePlan.length === 0 && (
          <div className="py-10 text-center text-[13px] text-[#9a8fb0]">No care plan items yet.</div>
        )}
      </div>
    </div>
  );
}
