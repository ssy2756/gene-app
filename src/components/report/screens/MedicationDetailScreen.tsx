"use client";

import type { DisplayReport } from "@/lib/report-mapping";

export function MedicationDetailScreen({
  report,
  drugId,
  goBack,
}: {
  report: DisplayReport;
  drugId: string | null;
  goBack: () => void;
}) {
  const drug = report.medications.find((d) => d.id === drugId) ?? report.medications[0];

  if (!drug) {
    return (
      <div className="px-5 pt-3">
        <button onClick={goBack} className="text-sm font-semibold text-[#3A2F88]">
          ← Medications
        </button>
        <div className="mt-6 text-center text-[13px] text-[#9a8fb0]">No medication data available.</div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="px-5 pb-2 pt-3">
        <button onClick={goBack} className="text-sm font-semibold text-[#3A2F88]">
          ← Medications
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
          <div
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-white"
            style={{ background: drug.color }}
          >
            ✓
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

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-3.5 text-[13px] shadow-[0_2px_8px_rgba(58,47,136,.05)]">
          <div>
            <div className="text-[11px] text-[#9a8fb0]">Gene</div>
            <div className="font-mono font-semibold">{drug.gene}</div>
          </div>
          <div>
            <div className="text-[11px] text-[#9a8fb0]">Diplotype</div>
            <div className="font-mono font-semibold">{drug.diplotype}</div>
          </div>
          <div>
            <div className="text-[11px] text-[#9a8fb0]">Phenotype</div>
            <div className="font-semibold">{drug.phenotype}</div>
          </div>
          <div>
            <div className="text-[11px] text-[#9a8fb0]">Evidence</div>
            <div className="font-semibold">{drug.evidence}</div>
          </div>
        </div>

        <div className="mt-4 text-sm font-bold">Recommendation notes</div>
        <div className="mt-1.5 text-[13.5px] leading-relaxed text-[#524a66]">{drug.recommendation}</div>

        <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl bg-[#f3eef9] p-3.5">
          <div className="mt-0.5 text-[#4D3F9C]">ⓘ</div>
          <div className="text-xs leading-relaxed text-[#5a4f70]">
            This is educational information from your genome, not a prescription. Always confirm changes with your
            prescriber.
          </div>
        </div>
      </div>
    </div>
  );
}
