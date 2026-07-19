"use client";

import type { DisplayReport } from "@/lib/report-mapping";

export function ProfileScreen({ report, onLogout }: { report: DisplayReport; onLogout: () => void }) {
  const { patient, uid } = report;
  const initials = patient.name !== "—" ? patient.name.slice(0, 2).toUpperCase() : "—";

  return (
    <div className="pb-28">
      <div className="flex flex-col items-center px-5 pt-4 text-center">
        <div
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-2xl font-bold text-white"
          style={{ background: "linear-gradient(135deg,#3A2F88,#4D3F9C)" }}
        >
          {initials}
        </div>
        <div className="mt-3 text-[19px] font-bold">{patient.name}</div>
        <div className="mt-0.5 text-[12.5px] text-[#8a819c]">UID {uid}</div>
      </div>

      <div className="px-5 pt-4">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#9a8fb0]">Your report</div>
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(58,47,136,.05)]">
          <Row label="Sample type" value={patient.sampleType} />
          <Row label="Collection date" value={patient.collectionDate} />
          <Row label="Sequencing type" value={patient.sequencingType} />
          <Row label="Method" value={patient.method} last />
        </div>

        <div className="mb-2 mt-4.5 text-[11px] font-bold uppercase tracking-wide text-[#9a8fb0]">Account</div>
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(58,47,136,.05)]">
          <button onClick={onLogout} className="flex w-full items-center gap-2.5 px-3.5 py-3.5 text-left">
            <span className="flex-1 text-sm">Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between px-3.5 py-3 ${last ? "" : "border-b border-[#f4f0f8]"}`}>
      <span className="text-[13.5px] text-[#524a66]">{label}</span>
      <span className="text-[13.5px] font-semibold">{value}</span>
    </div>
  );
}
