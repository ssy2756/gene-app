"use client";

import type { ReactNode } from "react";
import type { ScreenName } from "./ReportApp";

const ICONS: Record<string, ReactNode> = {
  home: (
    <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  ),
  meds: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="4" strokeWidth="1.9" />
      <line x1="12" y1="8" x2="12" y2="16" strokeWidth="1.9" />
    </>
  ),
  risks: <path d="M3 12h4l2-5 3 10 2-7 2 2h5" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
  lifestyle: (
    <path
      d="M12 20c5-4 7-8 7-11a4 4 0 00-7-2.5A4 4 0 005 9c0 3 2 7 7 11z"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
  ),
  care: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="3" strokeWidth="1.9" />
      <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1M9 12l2 2 4-4" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.5" strokeWidth="1.9" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeWidth="1.9" strokeLinecap="round" />
    </>
  ),
};

const TABS: { key: ScreenName; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "meds", label: "Meds" },
  { key: "risks", label: "Risks" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "care", label: "Care" },
  { key: "profile", label: "Profile" },
];

export function TabBar({ active, onSelect }: { active: ScreenName; onSelect: (s: ScreenName) => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md justify-between border-t border-[#e7e0ef] bg-[rgba(251,250,255,.94)] px-3 pb-6 pt-2 backdrop-blur">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const color = isActive ? "#3A2F88" : "#9a8fb0";
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className="flex flex-1 flex-col items-center gap-1"
            style={{ color }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              {ICONS[tab.key]}
            </svg>
            <span className="text-[9px] font-semibold">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
