"use client";

import type { DisplayReport } from "@/lib/report-mapping";

export function HomeScreen({
  report,
  goRisks,
  goCare,
}: {
  report: DisplayReport;
  goRisks: () => void;
  goCare: () => void;
}) {
  const { patient, home, carePlan } = report;
  const topCareItems = carePlan.slice(0, 3);

  return (
    <div className="pb-28">
      <div
        className="relative overflow-hidden rounded-b-[26px] px-6 pb-6 pt-5"
        style={{ background: "linear-gradient(150deg, #BFBBDC, #6A5FA8)" }}
      >
        <div className="relative mt-1 text-2xl font-semibold leading-tight text-white">
          Good morning, {patient.name !== "—" ? patient.name.split(" ")[0] : "there"}
        </div>
        <div className="relative mt-1 text-xs text-[#d9c9ee]">Your genome, at a glance</div>
      </div>

      <div className="mx-5 -mt-4 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(58,47,136,.05)]">
        <div className="flex items-baseline justify-between pb-1">
          <span className="text-[15px] font-semibold">Health risks overview</span>
        </div>
        <div className="flex items-center gap-4 pt-2">
          <div className="relative h-[100px] w-[100px] flex-none rounded-full bg-white shadow-inner">
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-[#2b2540]">{home.conditionsTotal}</span>
              <span className="mt-1 text-[8px] font-bold uppercase tracking-wide text-[#9a8fb0]">Conditions</span>
              <span className="text-[8px] font-bold uppercase tracking-wide text-[#9a8fb0]">Analyzed</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {home.riskCounts.map((r) => (
              <button
                key={r.level}
                onClick={goRisks}
                className="flex items-center justify-between gap-2 text-left"
              >
                <span
                  className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                  style={{ background: r.bg, color: r.text }}
                >
                  {r.label}
                </span>
                <span className="text-sm font-bold text-[#2b2540]">{r.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-5 mt-5 rounded-2xl bg-white shadow-[0_2px_8px_rgba(58,47,136,.05)]">
        <div className="flex items-baseline justify-between px-4 pb-3 pt-4">
          <span className="text-[15px] font-semibold">Most frequent monitoring</span>
          <button onClick={goCare} className="text-xs font-semibold text-[#3A2F88]">
            See care plan
          </button>
        </div>
        {topCareItems.length === 0 && (
          <div className="px-4 pb-4 text-[13px] text-[#8a819c]">No monitoring items yet.</div>
        )}
        {topCareItems.map((a) => (
          <div
            key={a.id}
            onClick={goCare}
            className="flex cursor-pointer items-center gap-3 border-t border-[#f2eef7] px-4 py-3"
          >
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-[#f3eef9] text-[11px] font-bold text-[#3A2F88]">
              {a.badge}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold">{a.label}</div>
              <div className="mt-0.5 truncate text-[11.5px] text-[#8a819c]">{a.reason}</div>
            </div>
            <span className="whitespace-nowrap rounded-full bg-[#f3eef9] px-2.5 py-1 text-[11px] font-semibold text-[#3A2F88]">
              {a.cadence}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
