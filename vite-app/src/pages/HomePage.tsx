import { Link, useNavigate } from "react-router-dom";
import StatusBar from "../components/StatusBar";
import Logo from "../components/Logo";
import { useHighlight } from "../lib/highlight-context";
import { useReportData } from "../lib/report-context";
import { styleForCategory, badgeForCategory } from "../lib/reportAdapter";

export default function HomePage() {
  const navigate = useNavigate();
  const { focusRiskLevel } = useHighlight();
  const { conditions, riskCounts, profile, carePlan, carePlanCategories } = useReportData();

  const total = conditions.length;
  const gap = riskCounts.length > 1 ? 5 : 0;
  const usable = 360 - gap * riskCounts.length;
  let cum = 0;
  const stops: string[] = [];
  riskCounts.forEach((r) => {
    const seg = (r.count / total) * usable;
    stops.push(`${r.color} ${cum}deg ${cum + seg}deg`);
    cum += seg;
    if (gap) {
      stops.push(`transparent ${cum}deg ${cum + gap}deg`);
      cum += gap;
    }
  });
  const gradient = stops.join(", ");

  const initials = profile.name
    .split(" ")
    .map((p) => p[0])
    .join("");

  function handleRiskClick(level: (typeof riskCounts)[number]["level"]) {
    focusRiskLevel(level);
    navigate("/risks");
  }

  return (
    <div className="rise-in">
      <StatusBar dark />

      <div
        className="relative overflow-hidden rounded-b-[26px] px-[22px] pb-6 pt-[18px]"
        style={{ background: "linear-gradient(150deg, #BFBBDC, #6A5FA8)" }}
      >
        <svg
          className="pointer-events-none absolute z-[7] opacity-[0.14]"
          style={{ right: -20, top: -2 }}
          width="130"
          height="150"
          viewBox="0 0 140 150"
          fill="none"
        >
          <path d="M38 0C38 26 100 34 100 60C100 86 38 94 38 120C38 142 100 150 100 150" stroke="#fff" strokeWidth="2.5" />
          <path d="M100 0C100 26 38 34 38 60C38 86 100 94 100 120C100 142 38 150 38 150" stroke="#fff" strokeWidth="2.5" />
          <line x1="45" y1="12" x2="93" y2="12" stroke="#fff" strokeWidth="1.5" />
          <line x1="55" y1="30" x2="83" y2="30" stroke="#fff" strokeWidth="1.5" />
          <line x1="55" y1="48" x2="83" y2="48" stroke="#fff" strokeWidth="1.5" />
          <line x1="45" y1="60" x2="93" y2="60" stroke="#fff" strokeWidth="1.5" />
          <line x1="55" y1="78" x2="83" y2="78" stroke="#fff" strokeWidth="1.5" />
          <line x1="55" y1="96" x2="83" y2="96" stroke="#fff" strokeWidth="1.5" />
          <line x1="45" y1="120" x2="93" y2="120" stroke="#fff" strokeWidth="1.5" />
        </svg>

        <div className="relative flex items-center justify-between gap-3">
          <Logo />
        </div>

        <div className="relative mt-[22px] flex items-start justify-between">
          <div className="text-2xl font-semibold leading-[1.15] tracking-tight text-white">
            Good morning, {profile.name.split(" ")[0]}
          </div>
          <Link
            to="/profile"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border text-[13px] font-semibold text-white"
            style={{ background: "rgba(255,255,255,.16)", borderColor: "rgba(255,255,255,.3)" }}
          >
            {initials}
          </Link>
        </div>
        <div className="relative mt-[5px] text-[12.5px]" style={{ color: "#d9c9ee" }}>
          Your genome, at a glance
        </div>
      </div>

      <Link
        to="/search"
        className="relative mx-5 -mt-3.5 flex cursor-pointer items-center gap-2.5 rounded-[15px] bg-white px-4 py-3.5"
        style={{ boxShadow: "0 4px 16px rgba(58,47,136,.14)" }}
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="6.5" stroke="#9a8fb0" strokeWidth="1.8" />
          <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="#9a8fb0" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="text-sm" style={{ color: "#9a8fb0" }}>
          Search drugs, conditions, nutrients…
        </span>
      </Link>

      <div className="card mx-5 mt-5">
        <div className="px-[18px] pb-1 pt-[17px]">
          <span className="text-[15px] font-semibold">Health risks overview</span>
        </div>
        <div className="flex items-center gap-[18px] px-[18px] pb-[18px] pt-2">
          <div className="relative h-[118px] w-[118px] flex-none">
            <div
              className="absolute rounded-full opacity-50"
              style={{ inset: -7, background: `conic-gradient(${gradient})`, filter: "blur(13px)" }}
            />
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(${gradient})`,
                filter: "drop-shadow(0 4px 10px rgba(58,47,136,.2))",
              }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "repeating-conic-gradient(rgba(255,255,255,.55) 0deg 1.6deg, transparent 1.6deg 6deg)",
                  mixBlendMode: "soft-light",
                }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 30% 26%, rgba(255,255,255,.45), transparent 55%)",
                }}
              />
            </div>
            <div className="absolute inset-[13px] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
              <span className="text-[22px] font-bold leading-none">{total}</span>
              <span className="mt-[3px] text-[8.5px] font-bold tracking-wide" style={{ color: "#9a8fb0" }}>
                CONDITIONS
              </span>
              <span className="text-[8.5px] font-bold tracking-wide" style={{ color: "#9a8fb0" }}>
                ANALYZED
              </span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2.5">
            {riskCounts.map((r) => (
              <button
                key={r.level}
                onClick={() => handleRiskClick(r.level)}
                className="flex items-center justify-between gap-2 text-left"
              >
                <span className="pill" style={{ background: r.bg, color: r.text }}>
                  {r.label}
                </span>
                <span className="text-sm font-bold">{r.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card mx-5 mb-5 mt-[18px]">
        <div className="flex items-baseline justify-between px-[18px] pb-1 pt-[17px]">
          <span className="text-[15px] font-semibold">Most frequent monitoring</span>
          <Link to="/care" className="text-xs font-semibold" style={{ color: "#3A2F88" }}>
            See care plan
          </Link>
        </div>
        {carePlan.slice(0, 3).map((a) => {
          const style = styleForCategory(a.category, carePlanCategories);
          return (
            <Link
              key={a.id}
              to="/care"
              className="flex items-center gap-3 border-t px-[18px] py-3"
              style={{ borderColor: "#f2eef7" }}
            >
              <div
                className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] text-[11px] font-bold"
                style={{ background: style.bg, color: style.color }}
              >
                {badgeForCategory(a.category)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">{a.label}</div>
                <div className="mt-px text-[11.5px]" style={{ color: "#8a819c" }}>
                  {a.reason}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
