"use client";

import type { DisplayReport } from "@/lib/report-mapping";
import { ChevronRightIcon } from "../Icons";
import { useInstallPrompt } from "@/lib/useInstallPrompt";

export function ProfileScreen({
  report,
  onLogout,
  goShare,
  openUpload,
}: {
  report: DisplayReport;
  onLogout: () => void;
  goShare: () => void;
  openUpload: () => void;
}) {
  const { patient, uid } = report;
  const initials = patient.name !== "—" ? patient.name.slice(0, 2).toUpperCase() : "—";
  const install = useInstallPrompt();

  return (
    <div className="pb-28" style={{ animation: "slideIn .25s ease" }}>
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
        <div className="overflow-hidden card rounded-2xl bg-white shadow-[0_2px_8px_rgba(58,47,136,.05)]">
          <Row label="Sample type" value={patient.sampleType} />
          <Row label="Collection date" value={patient.collectionDate} />
          <Row label="Sequencing type" value={patient.sequencingType} />
          <Row label="Method" value={patient.method} last />
        </div>

        {(install.canPromptInstall || install.showIosInstructions || install.installed) && (
          <>
            <div className="mb-2 mt-4.5 text-[11px] font-bold uppercase tracking-wide text-[#9a8fb0]">
              Install app
            </div>
            <div className="overflow-hidden card rounded-2xl bg-white shadow-[0_2px_8px_rgba(58,47,136,.05)]">
              {install.installed && (
                <div className="px-3.5 py-3.5 text-sm text-[#524a66]">
                  ✓ Installed — you&apos;re using GenepowerX from your home screen.
                </div>
              )}
              {!install.installed && install.canPromptInstall && (
                <button
                  onClick={install.promptInstall}
                  className="flex w-full items-center gap-2.5 px-3.5 py-3.5 text-left"
                >
                  <span className="flex-1 text-sm">Add to Home Screen</span>
                  <ChevronRightIcon />
                </button>
              )}
              {!install.installed && install.showIosInstructions && (
                <div className="px-3.5 py-3.5 text-[13px] leading-relaxed text-[#524a66]">
                  Tap the Share icon in Safari, then <span className="font-semibold">Add to Home Screen</span> to
                  install this app.
                </div>
              )}
            </div>
          </>
        )}

        <div className="mb-2 mt-4.5 text-[11px] font-bold uppercase tracking-wide text-[#9a8fb0]">Settings</div>
        <div className="overflow-hidden card rounded-2xl bg-white shadow-[0_2px_8px_rgba(58,47,136,.05)]">
          <button onClick={goShare} className="flex w-full items-center gap-2.5 border-b border-[#f4f0f8] px-3.5 py-3.5 text-left">
            <ShareIconDark />
            <span className="flex-1 text-sm">Share summary with doctor</span>
            <ChevronRightIcon />
          </button>
          <button onClick={openUpload} className="flex w-full items-center gap-2.5 px-3.5 py-3.5 text-left">
            <UploadIconDark />
            <span className="flex-1 text-sm">Upload a new report</span>
            <ChevronRightIcon />
          </button>
        </div>

        <div className="mb-2 mt-4.5 text-[11px] font-bold uppercase tracking-wide text-[#9a8fb0]">Account</div>
        <div className="overflow-hidden card rounded-2xl bg-white shadow-[0_2px_8px_rgba(58,47,136,.05)]">
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
    <div className={`flex justify-between gap-4 px-3.5 py-3 ${last ? "" : "border-b border-[#f4f0f8]"}`}>
      <span className="flex-none text-[13.5px] text-[#524a66]">{label}</span>
      <span className="text-right text-[13.5px] font-semibold">{value}</span>
    </div>
  );
}

function ShareIconDark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M8 12h8M12 8l4 4-4 4" stroke="#3A2F88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7V5a1 1 0 011-1h4M4 17v2a1 1 0 001 1h4" stroke="#3A2F88" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UploadIconDark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v12M8 7l4-4 4 4M5 15v4a2 2 0 002 2h10a2 2 0 002-2v-4" stroke="#3A2F88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
