"use client";

import type { ScreenName } from "./ReportApp";

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
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className="flex flex-1 flex-col items-center gap-1"
            style={{ color: isActive ? "#3A2F88" : "#9a8fb0" }}
          >
            <span className="text-[9px] font-semibold">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
