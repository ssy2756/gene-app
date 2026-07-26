import { useMemo, useState } from "react";
import StatusBar from "../components/StatusBar";
import { useReportData } from "../lib/report-context";
import { styleForCategory, badgeForCategory } from "../lib/reportAdapter";

export default function CarePlanPage() {
  const { carePlan, carePlanCategories } = useReportData();
  const [filter, setFilter] = useState("All");
  const [reminders, setReminders] = useState<Record<string, boolean>>({});

  const present = useMemo(() => ["All", ...carePlanCategories], [carePlanCategories]);

  const items = filter === "All" ? carePlan : carePlan.filter((a) => a.category === filter);

  function toggleReminder(id: string) {
    setReminders((r) => ({ ...r, [id]: !r[id] }));
  }

  return (
    <div className="slide-in">
      <StatusBar />
      <div
        className="sticky top-0 z-10 px-5 pb-2 pt-1"
        style={{ background: "rgba(246,244,248,.9)", backdropFilter: "blur(10px)" }}
      >
        <div className="text-[22px] font-bold tracking-tight">Care plan</div>
        <div className="mt-0.5 text-[12.5px]" style={{ color: "#8a819c" }}>
          Monitoring &amp; follow-ups, all in one place
        </div>
        <div className="hide-sb mt-3 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {present.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="chip"
              style={{
                background: filter === f ? "#3A2F88" : "#fff",
                color: filter === f ? "#fff" : "#524a66",
                borderColor: filter === f ? "#3A2F88" : "#e7e0ef",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-3">
        {items.map((a) => {
          const style = styleForCategory(a.category, carePlanCategories);
          const on = !!reminders[a.id];
          return (
            <div key={a.id} className="card flex items-center gap-3 px-4 py-3.5">
              <div
                className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] text-xs font-bold"
                style={{ background: style.bg, color: style.color }}
              >
                {badgeForCategory(a.category)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{a.label}</div>
                <div className="mt-0.5 text-[11.5px]" style={{ color: "#8a819c" }}>
                  {a.reason}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <button
                  onClick={() => toggleReminder(a.id)}
                  className="pressable flex cursor-pointer items-center gap-1"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={on ? "#3A2F88" : "none"}
                    stroke={on ? "#3A2F88" : "#b8adc9"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 8a6 6 0 0112 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" />
                    <path d="M9.5 17a2.5 2.5 0 005 0" />
                  </svg>
                  <span
                    className="text-[10.5px] font-semibold"
                    style={{ color: on ? "#3A2F88" : "#b8adc9" }}
                  >
                    {on ? "Reminder on" : "Add reminder"}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="py-10 text-center text-sm" style={{ color: "#9a8fb0" }}>
            No items in this category.
          </div>
        )}
      </div>
    </div>
  );
}
