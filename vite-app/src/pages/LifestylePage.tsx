import StatusBar from "../components/StatusBar";
import { RISK_META } from "../lib/data";
import { useReportData } from "../lib/report-context";

export default function LifestylePage() {
  const { vitTiers, sensitivities, fitnessTraits } = useReportData();
  return (
    <div className="slide-in">
      <StatusBar />
      <div className="sticky top-0 z-10 px-5 pb-3 pt-1" style={{ background: "rgba(246,244,248,.9)", backdropFilter: "blur(10px)" }}>
        <div className="text-[22px] font-bold tracking-tight">Lifestyle</div>
        <div className="mt-0.5 text-[12.5px]" style={{ color: "#8a819c" }}>
          Nutrition, sensitivities &amp; fitness
        </div>
      </div>

      <div className="px-5 pt-1">
        <div className="mb-2.5 text-sm font-bold">Vitamins &amp; minerals</div>
        {vitTiers.map((t) => (
          <div key={t.tier} className="mb-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: t.color }} />
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: t.color }}>
                {t.tier}
              </span>
            </div>
            <div className="card overflow-hidden">
              {t.items.map((v, i) => (
                <div
                  key={v.name}
                  className="flex items-center gap-3 px-[15px] py-3"
                  style={i < t.items.length - 1 ? { borderBottom: "1px solid #f4f0f8" } : undefined}
                >
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{v.name}</div>
                    <div className="mt-px text-[11px]" style={{ color: "#8a819c" }}>
                      {v.why}
                    </div>
                  </div>
                  <span
                    className="rounded-lg px-2.5 py-1 text-xs font-semibold"
                    style={{ background: "#f3eef9", color: "#3A2F88" }}
                  >
                    {v.dose}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="my-4 text-sm font-bold">Food sensitivities</div>
        <div className="flex flex-col gap-[9px]">
          {sensitivities.map((s) => {
            const meta = RISK_META[s.risk];
            return (
              <div key={s.name} className="card flex items-center gap-3 px-[15px] py-3.5">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="mt-0.5 text-[11.5px]" style={{ color: "#8a819c" }}>
                    {s.gene}
                  </div>
                </div>
                <span className="pill" style={{ background: meta.bg, color: meta.text }}>
                  {meta.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="my-4 text-sm font-bold">Fitness &amp; exercise</div>
        <div className="card p-4">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-[58px] w-[52px] flex-none items-center justify-center"
              style={{ clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)", background: "#2fb08c" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M6 8v8M18 8v8M6 12h12M3 10v4M21 10v4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="text-[15px] font-bold">Endurance-leaning</div>
              <div className="mt-0.5 text-xs" style={{ color: "#8a819c" }}>
                ACTN3 R/X · slower recovery profile
              </div>
            </div>
          </div>
          <div className="mt-3.5 flex flex-col gap-[9px]">
            {fitnessTraits.map((f, i) => (
              <div key={i} className="flex items-start gap-[9px]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-none">
                  <circle cx="12" cy="12" r="9" stroke="#2fb08c" strokeWidth="2" />
                  <path d="M8.5 12l2.5 2.5 4.5-5" stroke="#2fb08c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[13px] leading-relaxed" style={{ color: "#524a66" }}>
                  {f}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
