import { Link, useParams } from "react-router-dom";
import StatusBar from "../components/StatusBar";
import { useReportData } from "../lib/report-context";

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  directed: { bg: "#e3f3ea", text: "#1f7d54", border: "#cdeadb", iconBg: "#eef1f2" },
  caution: { bg: "#fbf1d8", text: "#a67a12", border: "#f2e2b8", iconBg: "#eef1f2" },
  adjust: { bg: "#fbe7d6", text: "#b35c14", border: "#f3d3ac", iconBg: "#eef1f2" },
};

const STATUS_LABEL: Record<string, string> = {
  directed: "Use as directed",
  caution: "Use with caution",
  adjust: "Adjust dosage",
};

function StatusIcon({ statusKey }: { statusKey: string }) {
  if (statusKey === "directed") {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4.5 4.5L19 7" stroke="#3f5964" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (statusKey === "caution") {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M12 3l10 18H2z" fill="#a13a34" />
        <line x1="12" y1="9.5" x2="12" y2="14.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17.3" r="1.1" fill="#fff" />
      </svg>
    );
  }
  return (
    <svg width="22" height="26" viewBox="0 0 24 28" fill="none">
      <path d="M8 4c0 8 0 16 0 22" stroke="#c9932f" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 4v10" stroke="#c9932f" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 14c0 6-4 6-4 12" stroke="#c9932f" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function definitionText(statusKey: string, adjustDirection?: "increase" | "decrease") {
  if (statusKey === "directed") return "Normal response expected with minimal or no side effects";
  if (statusKey === "caution") return "Consider alternative or proceed with caution";
  return adjustDirection === "increase" ? "Increase dosage" : "Decrease dosage";
}

export default function DrugDetailPage() {
  const { id } = useParams();
  const { drugs } = useReportData();
  const drug = drugs.find((d) => d.id === id);

  if (!drug) {
    return <div className="px-5 py-8 text-center" style={{ color: "#8a819c" }}>Drug not found.</div>;
  }

  const s = STATUS_STYLE[drug.statusKey];

  return (
    <div className="slide-in">
      <StatusBar />
      <div
        className="sticky top-0 z-10 flex items-center gap-1.5 px-4 py-3"
        style={{ background: "rgba(246,244,248,.9)", backdropFilter: "blur(10px)" }}
      >
        <Link to="/medications" className="text-sm font-semibold" style={{ color: "#3A2F88" }}>
          ← Medications
        </Link>
      </div>

      <div className="px-5">
        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: s.text }}>
          {drug.category}
        </div>
        <div className="mt-1 text-[26px] font-bold tracking-tight">{drug.name}</div>
        <div className="mt-0.5 text-[13px]" style={{ color: "#8a819c" }}>
          {drug.klass}
        </div>

        <div
          className="mt-4 flex flex-col items-center gap-3 rounded-[18px] px-4 py-6 text-center"
          style={{ background: s.bg, border: `1px solid ${s.border}` }}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "#fff", boxShadow: "0 4px 10px rgba(0,0,0,.08)" }}
          >
            <StatusIcon statusKey={drug.statusKey} />
          </div>
          <div>
            <div className="text-[18px] font-bold" style={{ color: "#2b2540" }}>
              {STATUS_LABEL[drug.statusKey]}
            </div>
            <div className="mt-1 text-[13.5px]" style={{ color: "#524a66" }}>
              {definitionText(drug.statusKey, drug.adjustDirection)}
            </div>
          </div>
        </div>

        <div className="mb-5 mt-3.5 flex items-start gap-2.5 rounded-2xl px-4 py-3.5" style={{ background: "#f3eef9" }}>
          <div className="text-xs leading-relaxed" style={{ color: "#5a4f70" }}>
            This is educational information from your genome, not a prescription. Always confirm changes with your
            prescriber.
          </div>
        </div>
      </div>
    </div>
  );
}
