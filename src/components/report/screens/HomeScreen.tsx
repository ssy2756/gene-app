"use client";

import Image from "next/image";
import type { DisplayReport } from "@/lib/report-mapping";

function buildRingGradient(riskCounts: DisplayReport["home"]["riskCounts"]): string {
  const nonZero = riskCounts.filter((r) => r.count > 0);
  const total = nonZero.reduce((n, r) => n + r.count, 0);
  if (total === 0) return "#eee6f2 0deg 360deg";

  const gap = nonZero.length > 1 ? 5 : 0;
  const usable = 360 - gap * nonZero.length;
  let cursor = 0;
  const stops: string[] = [];
  nonZero.forEach((r) => {
    const deg = (r.count / total) * usable;
    stops.push(`${r.color} ${cursor}deg ${cursor + deg}deg`);
    cursor += deg;
    if (gap) {
      stops.push(`transparent ${cursor}deg ${cursor + gap}deg`);
      cursor += gap;
    }
  });
  return stops.join(", ");
}

export function HomeScreen({
  report,
  goRisks,
  goCare,
  goProfile,
  openSearch,
}: {
  report: DisplayReport;
  goRisks: () => void;
  goCare: () => void;
  goProfile: () => void;
  openSearch: () => void;
}) {
  const { patient, home, carePlan } = report;
  const topConditions = carePlan.slice(0, 3);
  const firstName = patient.name !== "—" ? patient.name.split(" ")[0] : "there";
  const initials = patient.name !== "—" ? patient.name.slice(0, 2).toUpperCase() : "—";
  const ringGradient = buildRingGradient(home.riskCounts);

  return (
    <div className="pb-28">
      <div
        className="relative overflow-hidden rounded-b-[26px] px-6 pb-6 pt-5"
        style={{ background: "linear-gradient(150deg, #BFBBDC, #6A5FA8)" }}
      >
        <svg
          className="pointer-events-none absolute -top-1 right-14 opacity-[0.14]"
          width="110" height="130" viewBox="0 0 140 150" fill="none"
        >
          <path d="M38 0C38 26 100 34 100 60C100 86 38 94 38 120C38 142 100 150 100 150" stroke="#fff" strokeWidth="2.5" />
          <path d="M100 0C100 26 38 34 38 60C38 86 100 94 100 120C100 142 38 150 38 150" stroke="#fff" strokeWidth="2.5" />
        </svg>

        <div className="relative flex items-center justify-between gap-3">
          <Image src="/genepowerx-logo.svg" alt="GenepowerX" width={150} height={35} priority />
          <button
            onClick={goProfile}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/30 bg-white/15 text-[13px] font-semibold text-white"
          >
            {initials}
          </button>
        </div>

        <div className="relative mt-5 text-2xl font-semibold leading-tight text-white">Good morning, {firstName}</div>
        <div className="relative mt-1 text-xs text-[#d9c9ee]">Your genome, at a glance</div>
      </div>

      <button
        onClick={openSearch}
        className="relative mx-5 flex items-center gap-2.5 bg-white text-left shadow-[0_4px_16px_rgba(58,47,136,.14)]"
        style={{ marginTop: "-14px", borderRadius: 15, padding: "13px 16px" }}
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="6.5" stroke="#9a8fb0" strokeWidth="1.8" />
          <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="#9a8fb0" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="text-sm text-[#9a8fb0]">Search drugs, conditions, nutrients…</span>
      </button>

      <div className="mx-5 mt-5 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(58,47,136,.05)]">
        <div className="flex items-baseline justify-between pb-1">
          <span className="text-[15px] font-semibold">Health risks overview</span>
        </div>
        <div className="flex items-center gap-4 pt-2">
          <div className="relative h-[118px] w-[118px] flex-none">
            <div
              className="absolute rounded-full opacity-50 blur-[13px]"
              style={{ inset: "-7px", background: `conic-gradient(${ringGradient})` }}
            />
            <div
              className="absolute inset-0 rounded-full drop-shadow-[0_4px_10px_rgba(58,47,136,.2)]"
              style={{ background: `conic-gradient(${ringGradient})` }}
            >
              <div
                className="absolute inset-0 rounded-full mix-blend-soft-light"
                style={{
                  background:
                    "repeating-conic-gradient(rgba(255,255,255,.5) 0deg 1.6deg, transparent 1.6deg 6deg)",
                }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "radial-gradient(circle at 30% 26%, rgba(255,255,255,.45), transparent 55%)",
                }}
              />
            </div>
            <div className="absolute inset-[13px] z-[3] flex flex-col items-center justify-center rounded-full bg-white shadow-[inset_0_1px_3px_rgba(58,47,136,.06)]">
              <span className="text-[22px] font-bold leading-none text-[#2b2540]">{home.conditionsTotal}</span>
              <span className="mt-[3px] text-[8.5px] font-bold uppercase tracking-wide text-[#9a8fb0]">Conditions</span>
              <span className="mt-[3px] text-[8.5px] font-bold uppercase tracking-wide text-[#9a8fb0]">Analyzed</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {home.riskCounts.map((r) => (
              <button key={r.level} onClick={goRisks} className="flex items-center justify-between gap-2 text-left">
                <span className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: r.bg, color: r.text }}>
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
        {topConditions.length === 0 && (
          <div className="px-4 pb-4 text-[13px] text-[#8a819c]">No monitoring items yet.</div>
        )}
        {topConditions.map((c) => (
          <div
            key={c.id}
            onClick={goCare}
            className="flex cursor-pointer items-center gap-3 border-t border-[#f2eef7] px-4 py-3"
          >
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-[#f3eef9] text-[11px] font-bold text-[#3A2F88]">
              {c.badge}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold">{c.name}</div>
              <div className="mt-0.5 truncate text-[11.5px] text-[#8a819c]">{c.checks[0]?.reason}</div>
            </div>
            <span className="whitespace-nowrap rounded-full bg-[#f3eef9] px-2.5 py-1 text-[11px] font-semibold text-[#3A2F88]">
              {c.checks.length} check{c.checks.length === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
