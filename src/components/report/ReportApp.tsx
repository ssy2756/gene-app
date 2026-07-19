"use client";

import { useState } from "react";
import type { DisplayReport } from "@/lib/report-mapping";
import { TabBar } from "./TabBar";
import { HomeScreen } from "./screens/HomeScreen";
import { MedicationsScreen } from "./screens/MedicationsScreen";
import { MedicationDetailScreen } from "./screens/MedicationDetailScreen";
import { DiplotypeScreen } from "./screens/DiplotypeScreen";
import { HealthRisksScreen } from "./screens/HealthRisksScreen";
import { ConditionDetailScreen } from "./screens/ConditionDetailScreen";
import { LifestyleScreen } from "./screens/LifestyleScreen";
import { CarePlanScreen } from "./screens/CarePlanScreen";
import { ProfileScreen } from "./screens/ProfileScreen";

export type ScreenName =
  | "home"
  | "meds"
  | "medDetail"
  | "diplotype"
  | "risks"
  | "condDetail"
  | "lifestyle"
  | "care"
  | "profile";

export function ReportApp({ report, onLogout }: { report: DisplayReport; onLogout: () => void }) {
  const [screen, setScreen] = useState<ScreenName>("home");
  const [drugId, setDrugId] = useState<string | null>(null);
  const [condId, setCondId] = useState<string | null>(null);

  const activeTab: ScreenName = screen === "medDetail" || screen === "diplotype" ? "meds" : screen === "condDetail" ? "risks" : screen;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#f6f4f8] text-[#2b2540]">
      {screen === "home" && <HomeScreen report={report} goRisks={() => setScreen("risks")} goCare={() => setScreen("care")} />}
      {screen === "meds" && (
        <MedicationsScreen
          report={report}
          openDrug={(id) => {
            setDrugId(id);
            setScreen("medDetail");
          }}
          goDiplotype={() => setScreen("diplotype")}
        />
      )}
      {screen === "medDetail" && (
        <MedicationDetailScreen report={report} drugId={drugId} goBack={() => setScreen("meds")} />
      )}
      {screen === "diplotype" && <DiplotypeScreen report={report} goBack={() => setScreen("meds")} />}
      {screen === "risks" && (
        <HealthRisksScreen
          report={report}
          openCondition={(id) => {
            setCondId(id);
            setScreen("condDetail");
          }}
        />
      )}
      {screen === "condDetail" && (
        <ConditionDetailScreen report={report} condId={condId} goBack={() => setScreen("risks")} />
      )}
      {screen === "lifestyle" && <LifestyleScreen report={report} />}
      {screen === "care" && <CarePlanScreen report={report} />}
      {screen === "profile" && <ProfileScreen report={report} onLogout={onLogout} />}

      <TabBar active={activeTab} onSelect={setScreen} />
    </div>
  );
}
