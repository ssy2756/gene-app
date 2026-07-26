import { Link, useParams } from "react-router-dom";
import StatusBar from "../components/StatusBar";
import { RISK_META } from "../lib/data";
import { useReportData } from "../lib/report-context";

export default function ConditionDetailPage() {
  const { id } = useParams();
  const { conditions } = useReportData();
  const cond = conditions.find((c) => c.id === id);

  if (!cond) {
    return <div className="px-5 py-8 text-center" style={{ color: "#8a819c" }}>Condition not found.</div>;
  }

  const meta = RISK_META[cond.risk];
  const order = ["low", "mild", "moderate", "high"];
  const idx = order.indexOf(cond.risk);
  const gaugePct = `${(idx + 0.5) * 25}%`;

  return (
    <div className="slide-in">
      <StatusBar />
      <div
        className="sticky top-0 z-10 flex items-center gap-1.5 px-4 py-3"
        style={{ background: "rgba(246,244,248,.9)", backdropFilter: "blur(10px)" }}
      >
        <Link to="/risks" className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#3A2F88" }}>
          ← Health risks
        </Link>
      </div>

      <div className="px-5">
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: meta.text }}>
          {cond.system}
        </div>
        <div className="mt-1 text-[26px] font-bold tracking-tight">{cond.name}</div>

        <div className="card mt-4 p-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold" style={{ color: "#524a66" }}>
              Your genetic risk
            </span>
            <span className="text-sm font-bold" style={{ color: meta.text }}>
              {meta.label}
            </span>
          </div>
          <div className="mt-3 flex h-[9px] overflow-hidden rounded-full" style={{ background: "#f0ecf4" }}>
            <div className="flex-1" style={{ background: "#2fa36b" }} />
            <div className="flex-1" style={{ background: "#c9a227" }} />
            <div className="flex-1" style={{ background: "#d97b28" }} />
            <div className="flex-1" style={{ background: "#c0504a" }} />
          </div>
          <div className="relative h-0">
            <div
              className="absolute -top-4 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-[3px] bg-white shadow"
              style={{ left: gaugePct, borderColor: meta.color }}
            />
          </div>
          <div className="mt-4 flex justify-between text-[10.5px]" style={{ color: "#9a8fb0" }}>
            <span>Low</span>
            <span>Mild</span>
            <span>Moderate</span>
            <span>High</span>
          </div>
        </div>

        <div className="mt-4 text-sm font-bold">In plain language</div>
        <div className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "#524a66" }}>
          {cond.explain}
        </div>

        <div className="mt-4 text-sm font-bold">The genetic mechanism</div>
        <div className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "#524a66" }}>
          {cond.mechanism}
        </div>

        {cond.genes.length > 0 && (
          <>
            <div className="mt-4 text-sm font-bold">Significant genes</div>
            <div className="mt-2 flex flex-col gap-2">
              {cond.genes.map((g) => (
                <div key={g.gene} className="card flex items-center gap-3 px-3.5 py-3">
                  <div className="font-mono text-[13.5px] font-semibold">{g.gene}</div>
                  <div className="font-mono text-xs" style={{ color: "#8a819c" }}>
                    {g.variant}
                  </div>
                  <div className="flex-1 text-right text-xs" style={{ color: "#524a66" }}>
                    {g.effect}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-4 text-sm font-bold">Recommendations</div>
        <div className="mb-5 mt-2 flex flex-col gap-2">
          {cond.recs.map((r, i) => (
            <div key={i} className="card flex items-start gap-2.5 px-3.5 py-3">
              <span className="mt-0.5" style={{ color: "#2fb08c" }}>
                ✓
              </span>
              <div className="text-[13px] leading-relaxed" style={{ color: "#524a66" }}>
                {r}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
