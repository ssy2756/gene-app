"use client";

import type { DisplayReport } from "@/lib/report-mapping";
import { CheckIcon } from "../Icons";

export function LifestyleScreen({ report }: { report: DisplayReport }) {
  const { vitamins, sensitivities, fitness } = report;

  return (
    <div className="pb-28">
      <div className="px-5 pb-3 pt-3">
        <div className="text-[22px] font-bold tracking-tight">Lifestyle</div>
        <div className="mt-0.5 text-[12.5px] text-[#8a819c]">Nutrition, sensitivities &amp; fitness</div>
      </div>

      <div className="px-5">
        <div className="mb-2.5 text-sm font-bold">Vitamins &amp; minerals</div>
        {vitamins.length === 0 && <div className="mb-4 text-[13px] text-[#9a8fb0]">No vitamin data available.</div>}
        {vitamins.map((t) => (
          <div key={t.tier} className="mb-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: t.color }}>
                {t.tier}
              </span>
            </div>
            <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(58,47,136,.05)]">
              {t.items.map((v, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-[#f4f0f8] px-3.5 py-3 last:border-b-0">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{v.name}</div>
                    <div className="mt-0.5 text-[11px] text-[#8a819c]">{v.why}</div>
                  </div>
                  <span className="rounded-lg bg-[#f3eef9] px-2.5 py-1 text-xs font-semibold text-[#3A2F88]">
                    {v.dose}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="my-4 text-sm font-bold">Food sensitivities</div>
        <div className="flex flex-col gap-2">
          {sensitivities.map((s, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_2px_8px_rgba(58,47,136,.05)]">
              <div className="flex-1">
                <div className="text-sm font-semibold">{s.name}</div>
                <div className="mt-0.5 text-[11.5px] text-[#8a819c]">{s.gene}</div>
              </div>
              <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: s.bg, color: s.text }}>
                {s.level}
              </span>
            </div>
          ))}
          {sensitivities.length === 0 && (
            <div className="text-[13px] text-[#9a8fb0]">No food sensitivity data available.</div>
          )}
        </div>

        <div className="my-4 text-sm font-bold">Fitness &amp; exercise</div>
        <div className="rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(58,47,136,.05)]">
          <div className="text-[15px] font-bold">{fitness.headline}</div>
          {fitness.sub && <div className="mt-0.5 text-xs text-[#8a819c]">{fitness.sub}</div>}
          <div className="mt-3.5 flex flex-col gap-2">
            {fitness.tips.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckIcon />
                <span className="text-[13px] leading-relaxed text-[#524a66]">{f}</span>
              </div>
            ))}
            {fitness.tips.length === 0 && <div className="text-[13px] text-[#9a8fb0]">No fitness data available.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
