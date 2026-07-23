"use client";

import type { DisplayReport } from "@/lib/report-mapping";
import { ChevronRightIcon } from "../Icons";

export function CarePlanScreen({
  report,
  openCondition,
}: {
  report: DisplayReport;
  openCondition: (id: string) => void;
}) {
  const { carePlan } = report;

  return (
    <div className="pb-28">
      <div className="px-5 pb-2 pt-3">
        <div className="text-[22px] font-bold tracking-tight">Care plan</div>
        <div className="mt-0.5 text-[12.5px] text-[#8a819c]">Monitoring &amp; follow-ups, by condition</div>
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-2">
        {carePlan.map((c) => (
          <button
            key={c.id}
            onClick={() => openCondition(c.id)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-[0_2px_8px_rgba(58,47,136,.05)]"
          >
            <div
              className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl text-xs font-bold"
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
            <ChevronRightIcon />
          </button>
        ))}
        {carePlan.length === 0 && (
          <div className="py-10 text-center text-[13px] text-[#9a8fb0]">No care plan items yet.</div>
        )}
      </div>
    </div>
  );
}
