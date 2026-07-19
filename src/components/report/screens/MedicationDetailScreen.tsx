"use client";

import type { DisplayReport } from "@/lib/report-mapping";
import { TapDefine } from "../TapDefine";
import { BackIcon, CheckIcon, InfoIcon, ShareIcon } from "../Icons";

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
    <div className="pb-28">
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
            <CheckIcon color="#fff" />
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

        <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl bg-white p-3.5 text-[13px] shadow-[0_2px_8px_rgba(58,47,136,.05)]">
          <div>
            <div className="text-[11px] text-[#9a8fb0]">Gene</div>
            <div className="cursor-pointer font-mono font-semibold text-[#3A2F88]" onClick={() => onDefine(drug.gene)}>
              {drug.gene}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#9a8fb0]">Diplotype</div>
            <div className="cursor-pointer font-mono font-semibold text-[#3A2F88]" onClick={() => onDefine("Diplotype")}>
              {drug.diplotype}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#9a8fb0]">Phenotype</div>
            <div className="cursor-pointer font-semibold text-[#3A2F88]" onClick={() => onDefine(drug.phenotype)}>
              {drug.phenotype}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[#9a8fb0]">Evidence</div>
            <div className="cursor-pointer font-semibold text-[#3A2F88]" onClick={() => onDefine("Evidence level")}>
              {drug.evidence}
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
