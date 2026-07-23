"use client";

import type { DisplayReport } from "@/lib/report-mapping";
import { TapDefine } from "../TapDefine";
import { BackIcon, CheckIcon } from "../Icons";

export function ConditionDetailScreen({
  report,
  condId,
  goBack,
  glossaryTerms,
  onDefine,
}: {
  report: DisplayReport;
  condId: string | null;
  goBack: () => void;
  glossaryTerms: string[];
  onDefine: (term: string) => void;
}) {
  const cond = report.conditions.find((c) => c.id === condId) ?? report.conditions[0];

  if (!cond) {
    return (
      <div className="px-5 pt-3">
        <button onClick={goBack} className="flex items-center gap-1 text-sm font-semibold text-[#3A2F88]">
          <BackIcon /> Health risks
        </button>
        <div className="mt-6 text-center text-[13px] text-[#9a8fb0]">No condition data available.</div>
      </div>
    );
  }

  return (
    <div className="pb-28" style={{ animation: "slideIn .22s ease" }}>
      <div className="px-5 pb-2 pt-3">
        <button onClick={goBack} className="flex items-center gap-1 text-sm font-semibold text-[#3A2F88]">
          <BackIcon /> Health risks
        </button>
      </div>

      <div className="px-5">
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: cond.text }}>
          {cond.system}
        </div>
        <div className="mt-1 text-[26px] font-bold tracking-tight">{cond.name}</div>

        <div className="mt-4 card rounded-2xl bg-white p-4.5 shadow-[0_2px_8px_rgba(58,47,136,.05)]">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-[#524a66]">Your genetic risk</span>
            <span className="text-sm font-bold" style={{ color: cond.text }}>
              {cond.riskLabel}
            </span>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-md bg-[#f0ecf4]">
            <div className="flex-1 bg-[#2fa36b]" />
            <div className="flex-1 bg-[#c9a227]" />
            <div className="flex-1 bg-[#d97b28]" />
            <div className="flex-1 bg-[#c0504a]" />
          </div>
          <div className="relative h-0">
            <div
              className="absolute -top-4 h-3.5 w-3.5 rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,.15)]"
              style={{
                left: cond.gaugePct,
                border: `3px solid ${cond.color}`,
                transform: "translateX(-50%)",
                animation: "markerDrop .55s .2s cubic-bezier(.2,.8,.2,1) both",
              }}
            />
          </div>
          <div className="mt-4 flex justify-between text-[10.5px] text-[#9a8fb0]">
            <span>Low</span>
            <span>Mild</span>
            <span>Moderate</span>
            <span>High</span>
          </div>
        </div>

        {cond.description && (
          <>
            <div className="mt-4 text-sm font-bold">In plain language</div>
            <div className="mt-1.5 text-[13.5px] leading-relaxed text-[#524a66]">
              <TapDefine text={cond.description} terms={glossaryTerms} onDefine={onDefine} />
            </div>
          </>
        )}

        {cond.narrative && (
          <>
            <div className="mt-4 text-sm font-bold">Your medical concerns answered</div>
            <div className="mt-1.5 text-[13.5px] leading-relaxed text-[#524a66]">
              <TapDefine text={cond.narrative} terms={glossaryTerms} onDefine={onDefine} />
            </div>
          </>
        )}

        {cond.recommendations.length > 0 && (
          <>
            <div className="mt-4 text-sm font-bold">Recommendations</div>
            <div className="mt-2 flex flex-col gap-2">
              {cond.recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5 card rounded-2xl bg-white p-3.5 shadow-[0_2px_8px_rgba(58,47,136,.05)]">
                  <CheckIcon />
                  <div className="text-[13px] leading-relaxed text-[#524a66]">
                    <TapDefine text={r} terms={glossaryTerms} onDefine={onDefine} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
