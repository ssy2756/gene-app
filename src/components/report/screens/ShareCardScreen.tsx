"use client";

import Image from "next/image";
import type { DisplayReport } from "@/lib/report-mapping";

export function ShareCardScreen({ report, goBack }: { report: DisplayReport; goBack: () => void }) {
  const { patient, genePanel, medications, uid } = report;
  const flagged = medications.filter((d) => d.statusKey === "caution" || d.statusKey === "adjust");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-[#efe9f6] pb-28">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <button onClick={goBack} className="text-sm font-semibold text-[#3A2F88]">
          ← Back
        </button>
        <div className="text-sm font-bold">Doctor summary</div>
        <div className="w-11" />
      </div>

      <div className="px-4">
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_6px_20px_rgba(58,47,136,.12)]">
          <div
            className="px-5 py-4.5 text-white"
            style={{ background: "linear-gradient(135deg,#3A2F88,#4D3F9C)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center rounded-lg bg-white px-2 py-1">
                <Image src="/genepowerx-logo.svg" alt="GenepowerX" width={90} height={16} />
              </div>
              <span className="text-[11px] text-[#d9c9ee]">Pharmacogenomic summary</span>
            </div>
            <div className="mt-3.5 flex items-end justify-between">
              <div>
                <div className="text-lg font-bold">{patient.name}</div>
                <div className="mt-0.5 text-[11.5px] text-[#d9c9ee]">
                  Age {patient.age} · Gender {patient.gender} · UID {uid}
                </div>
              </div>
              <div className="text-right text-[11px] text-[#d9c9ee]">
                Report
                <br />
                {today}
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#9a8fb0]">Gene diplotype panel</div>
            <div className="mt-2.5 flex flex-col">
              {genePanel.map((g, i) => (
                <div key={i} className="flex items-center gap-2.5 border-b border-[#f2eef7] py-2.5 last:border-b-0">
                  <div className="h-2 w-2 flex-none rounded-full" style={{ background: g.color }} />
                  <div className="w-[88px] flex-none text-[13.5px] font-semibold">{g.gene}</div>
                  <div className="w-16 flex-none font-mono text-[13px] text-[#6a6478]">{g.diplotype}</div>
                  <div className="flex-1 text-right text-[12.5px] text-[#524a66]">{g.phenotype}</div>
                </div>
              ))}
              {genePanel.length === 0 && (
                <div className="py-3 text-center text-[13px] text-[#9a8fb0]">No diplotype data available.</div>
              )}
            </div>

            <div className="mt-4.5 text-[11px] font-bold uppercase tracking-wide text-[#9a8fb0]">
              Flagged medications
            </div>
            <div className="mt-2.5 flex flex-col gap-2">
              {flagged.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 rounded-xl border border-[#f0ecf4] px-3.5 py-2.5">
                  <div className="h-full w-1 flex-none self-stretch rounded" style={{ background: d.color }} />
                  <div className="flex-1">
                    <div className="text-[13.5px] font-semibold">{d.name}</div>
                    <div className="mt-0.5 text-[11px] text-[#8a819c]">
                      {d.gene} · {d.phenotype}
                    </div>
                  </div>
                  <span
                    className="rounded-lg px-2 py-1 text-[10.5px] font-bold"
                    style={{ background: d.pillBg, color: d.pillText }}
                  >
                    {d.short}
                  </span>
                </div>
              ))}
              {flagged.length === 0 && (
                <div className="text-center text-[13px] text-[#9a8fb0]">No flagged medications.</div>
              )}
            </div>

            <div className="mt-4 text-[10.5px] leading-relaxed text-[#9a8fb0]">
              Guided by CPIC / PharmGKB. Status labels are guidance, never a directive to avoid. Confirm all decisions
              clinically.
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2.5">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-2xl bg-[#3A2F88] py-3.5 text-center text-sm font-semibold text-white shadow-[0_6px_16px_rgba(58,47,136,.24)]"
          >
            Print
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-2xl border border-[#d9cdec] bg-white py-3.5 text-center text-sm font-semibold text-[#3A2F88]"
          >
            Share PDF
          </button>
        </div>
      </div>
    </div>
  );
}
