import { NavLink } from "react-router-dom";

const ACTIVE = "#3A2F88";
const INACTIVE = "#9a8fb0";

const TABS: { to: string; label: string; icon: (color: string) => React.ReactNode }[] = [
  {
    to: "/",
    label: "Home",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c}>
        <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/medications",
    label: "Meds",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c}>
        <rect x="3" y="8" width="18" height="8" rx="4" strokeWidth="1.9" />
        <line x1="12" y1="8" x2="12" y2="16" strokeWidth="1.9" />
      </svg>
    ),
  },
  {
    to: "/risks",
    label: "Risks",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c}>
        <path d="M3 12h4l2-5 3 10 2-7 2 2h5" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/lifestyle",
    label: "Lifestyle",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c}>
        <path
          d="M12 20c5-4 7-8 7-11a4 4 0 00-7-2.5A4 4 0 005 9c0 3 2 7 7 11z"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    to: "/care",
    label: "Care",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c}>
        <rect x="5" y="4" width="14" height="17" rx="3" strokeWidth="1.9" />
        <path d="M9 4V3a1 1 0 011-1h4a1 1 0 011 1v1M9 12l2 2 4-4" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/profile",
    label: "Profile",
    icon: (c) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c}>
        <circle cx="12" cy="8" r="3.5" strokeWidth="1.9" />
        <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function TabBar() {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex justify-between border-t px-3 pb-5 pt-2 backdrop-blur-md"
      style={{ borderColor: "#e7e0ef", background: "rgba(251,250,255,.94)" }}
    >
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === "/"}
          data-tab-nav="true"
          className="tabbar-item flex flex-1 flex-col items-center gap-1"
        >
          {({ isActive }) => {
            const color = isActive ? ACTIVE : INACTIVE;
            return (
              <>
                <span className="tabbar-icon">{t.icon(color)}</span>
                <span className="text-[9px] font-semibold" style={{ color }}>
                  {t.label}
                </span>
              </>
            );
          }}
        </NavLink>
      ))}
    </div>
  );
}
