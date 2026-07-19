"use client";

import type { DisplayReport } from "@/lib/report-mapping";

export function DiplotypeScreen({ report, goBack }: { report: DisplayReport; goBack: () => void }) {
  return (
    <div className="pb-28">
      <div className="px-5 pb-2 pt-3">
        <button onClick={goBack} className="text-sm font-semibold text-[#3A2F88]">
          ← Medications
        </button>
      </div>

      <div className="px-5">
        <div className="text-[12.5px] leading-relaxed text-[#8a819c]">
          These are your raw genotype results — the star-allele diplotype and predicted metabolizer status for each
          pharmacogene tested. Medication recommendations on the previous screens are derived from this panel.
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(58,47,136,.05)]">
          {report.genePanel.map((g, i) => (
            <div
              key={`${g.gene}-${i}`}
              className="flex items-center gap-2.5 border-b border-[#f2eef7] px-3.5 py-3 last:border-b-0"
            >
              <div className="h-2 w-2 flex-none rounded-full" style={{ background: g.color }} />
              <div className="w-20 flex-none text-sm font-semibold">{g.gene}</div>
              <div className="w-[70px] flex-none font-mono text-[13px] text-[#6a6478]">{g.diplotype}</div>
              <div className="flex-1 text-right text-xs text-[#524a66]">{g.phenotype}</div>
            </div>
          ))}
          {report.genePanel.length === 0 && (
            <div className="px-4 py-6 text-center text-[13px] text-[#9a8fb0]">No diplotype data available.</div>
          )}
        </div>

        <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl bg-[#f3eef9] p-3.5">
          <div className="mt-0.5 text-[#4D3F9C]">ⓘ</div>
          <div className="text-xs leading-relaxed text-[#5a4f70]">
            This panel reflects germline genotype only — it does not change over time and does not need to be
            retested.
          </div>
        </div>
      </div>
    </div>
  );
}
