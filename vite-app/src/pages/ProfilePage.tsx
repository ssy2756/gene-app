import { useNavigate } from "react-router-dom";
import StatusBar from "../components/StatusBar";
import { useReportData } from "../lib/report-context";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { profile } = useReportData();
  const initials = profile.name
    .split(" ")
    .map((p) => p[0])
    .join("");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    navigate("/login", { replace: true });
    window.location.reload();
  }

  return (
    <div className="slide-in">
      <StatusBar />
      <div className="flex flex-col items-center px-5 pt-2 text-center">
        <div
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full text-2xl font-bold text-white"
          style={{ background: "linear-gradient(135deg,#3A2F88,#4D3F9C)" }}
        >
          {initials}
        </div>
        <div className="mt-3 text-[19px] font-bold">{profile.name}</div>
        <div className="mt-0.5 text-[12.5px]" style={{ color: "#8a819c" }}>
          MRN {profile.mrn}
        </div>
      </div>

      <div className="px-5 pt-[18px]">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#9a8fb0" }}>
          Your report
        </div>
        <div className="card overflow-hidden">
          <div className="flex justify-between px-[15px] py-3" style={{ borderBottom: "1px solid #f4f0f8" }}>
            <span className="text-[13.5px]" style={{ color: "#524a66" }}>
              Test
            </span>
            <span className="text-[13.5px] font-semibold">{profile.test}</span>
          </div>
          <div className="flex justify-between px-[15px] py-3" style={{ borderBottom: "1px solid #f4f0f8" }}>
            <span className="text-[13.5px]" style={{ color: "#524a66" }}>
              Sample collected
            </span>
            <span className="text-[13.5px] font-semibold">{profile.sampleCollected}</span>
          </div>
          <div className="flex justify-between px-[15px] py-3">
            <span className="text-[13.5px]" style={{ color: "#524a66" }}>
              Lab
            </span>
            <span className="text-[13.5px] font-semibold">{profile.lab}</span>
          </div>
        </div>

        <div className="mb-2 mt-[18px] text-[11px] font-bold uppercase tracking-wide" style={{ color: "#9a8fb0" }}>
          Settings
        </div>
        <div className="card mb-5 overflow-hidden">
          <div className="flex items-center gap-2.5 px-[15px] py-3.5" style={{ borderBottom: "1px solid #f4f0f8" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M8 12h8M12 8l4 4-4 4" stroke="#3A2F88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="flex-1 text-sm">Share summary with doctor</span>
            <span style={{ color: "#c9bdde" }}>›</span>
          </div>
          <div className="flex items-center gap-2.5 px-[15px] py-3.5" style={{ borderBottom: "1px solid #f4f0f8" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3v12M8 7l4-4 4 4M5 15v4a2 2 0 002 2h10a2 2 0 002-2v-4"
                stroke="#3A2F88"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="flex-1 text-sm">Download full report (PDF)</span>
            <span style={{ color: "#c9bdde" }}>›</span>
          </div>
          <div className="flex items-center gap-2.5 px-[15px] py-3.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="#3A2F88" strokeWidth="2" />
              <path
                d="M19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 00-1.7-1l-.4-2.6h-4l-.4 2.6a7 7 0 00-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 000 2l-2 1.5 2 3.4 2.4-1a7 7 0 001.7 1l.4 2.6h4l.4-2.6a7 7 0 001.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z"
                stroke="#3A2F88"
                strokeWidth="1.6"
              />
            </svg>
            <span className="flex-1 text-sm">Privacy &amp; data</span>
            <span style={{ color: "#c9bdde" }}>›</span>
          </div>
        </div>

        <button onClick={handleLogout} className="card mb-5 w-full px-[15px] py-3.5 text-left text-sm font-semibold" style={{ color: "#a13a34" }}>
          Log out
        </button>
      </div>
    </div>
  );
}
