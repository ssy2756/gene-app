import { Link } from "react-router-dom";
import StatusBar from "../components/StatusBar";
import { useReportData } from "../lib/report-context";

export default function DiplotypePanelPage() {
  const { genePanel } = useReportData();
  return (
    <div className="slide-in">
      <StatusBar />
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(246,244,248,.9)", backdropFilter: "blur(10px)" }}
      >
        <Link to="/medications" className="flex items-center gap-1 text-sm font-semibold" style={{ color: "#3A2F88" }}>
          ← Back
        </Link>
        <div className="text-sm font-bold">Diplotype panel</div>
        <div style={{ width: 44 }} />
      </div>

      <div className="px-5">
        <div className="text-[12.5px] leading-relaxed" style={{ color: "#8a819c" }}>
          These are your raw genotype results — the star-allele diplotype and predicted metabolizer status for each
          pharmacogene tested. Medication recommendations elsewhere in the app are derived from this panel.
        </div>

        <div className="card mt-4 overflow-hidden px-1 py-1.5">
          {genePanel.map((g, i) => (
            <div
              key={g.gene}
              className="flex items-center gap-2.5 px-3.5 py-3"
              style={i < genePanel.length - 1 ? { borderBottom: "1px solid #f2eef7" } : undefined}
            >
              <div className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: "#4D3F9C" }} />
              <div className="w-[78px] flex-none text-sm font-semibold">{g.gene}</div>
              <div className="w-[72px] flex-none font-mono text-[13px]" style={{ color: "#6a6478" }}>
                {g.diplotype}
              </div>
              <div className="flex-1 text-right text-xs" style={{ color: "#524a66" }}>
                {g.phenotype}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-5 mt-3.5 flex items-start gap-2.5 rounded-2xl px-4 py-3.5" style={{ background: "#f3eef9" }}>
          <div className="text-xs leading-relaxed" style={{ color: "#5a4f70" }}>
            This panel reflects germline genotype only — it does not change over time and does not need to be
            retested.
          </div>
        </div>
      </div>
    </div>
  );
}
