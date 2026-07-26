"use client";

import type { DisplayReport } from "@/lib/report-mapping";
import { TapDefine } from "../TapDefine";
import { BackIcon, CheckIcon, InfoIcon, ShareIcon } from "../Icons";

// Mockup's `icon(status)`: a checkmark for "directed", an exclamation glyph
// for every other status (caution / adjust / evidence).
function BannerIcon({ statusKey }: { statusKey: string }) {
  if (statusKey === "directed") return <CheckIcon color="#fff" />;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v5M12 16.5v.01" />
    </svg>
  );
}

export function MedicationDetailScreen({
  report,
  drugId,
  goBack,
  goShare,
  glossaryTerms,
  onDefine,
}: {
  report: DisplayReport;
  drugId: string | null;
  goBack: () => void;
  goShare: () => void;
  glossaryTerms: string[];
  onDefine: (term: string) => void;
}) {
  const drug = report.medications.find((d) => d.id === drugId) ?? report.medications[0];

  if (!drug) {
    return (
      <div className="px-5 pt-3">
        <button onClick={goBack} className="flex items-center gap-1 text-sm font-semibold text-[#3A2F88]">
          <BackIcon /> Medications
        </button>
        <div className="mt-6 text-center text-[13px] text-[#9a8fb0]">No medication data available.</div>
      </div>
    );
  }

  return (
    <div className="pb-28" style={{ animation: "slideIn .22s ease" }}>
      <div className="px-5 pb-2 pt-3">
        <button onClick={goBack} className="flex items-center gap-1 text-sm font-semibold text-[#3A2F88]">
          <BackIcon /> Medications
        </button>
      </div>

      <div className="px-5">
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: drug.pillText }}>
          {drug.system}
        </div>
        <div className="mt-1 text-[26px] font-bold tracking-tight">{drug.name}</div>
        <div className="mt-1 text-[13px] text-[#8a819c]">{drug.klass}</div>

        <div
          className="mt-4 flex items-center gap-3.5 rounded-2xl border p-4"
          style={{ background: drug.bannerBg, borderColor: drug.bannerBorder }}
        >
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-white" style={{ background: drug.color }}>
            <BannerIcon statusKey={drug.statusKey} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: drug.pillText }}>
              Recommendation
            </div>
            <div className="mt-0.5 text-[17px] font-bold" style={{ color: drug.pillText }}>
              {drug.status}
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm font-bold">Recommendation notes</div>
        <div className="mt-1.5 text-[13.5px] leading-relaxed text-[#524a66]">
          <TapDefine text={drug.recommendation} terms={glossaryTerms} onDefine={onDefine} />
        </div>

        <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl bg-[#f3eef9] p-3.5">
          <InfoIcon />
          <div className="text-xs leading-relaxed text-[#5a4f70]">
            This is educational information from your genome, not a prescription. Always confirm changes with your
            prescriber.
          </div>
        </div>

        <button
          onClick={goShare}
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#3A2F88] py-3.5 shadow-[0_6px_16px_rgba(58,47,136,.28)]"
        >
          <ShareIcon />
          <span className="text-sm font-semibold text-white">Share with doctor</span>
        </button>
      </div>
    </div>
  );
}
