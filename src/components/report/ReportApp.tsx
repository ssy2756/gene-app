"use client";

import { useMemo, useState } from "react";
import type { DisplayReport } from "@/lib/report-mapping";
import { buildGlossary } from "@/lib/glossary";
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
import { ShareCardScreen } from "./screens/ShareCardScreen";
import { SearchOverlay } from "./sheets/SearchOverlay";
import { DefineSheet } from "./sheets/DefineSheet";
import { UploadSheet } from "./sheets/UploadSheet";

export type ScreenName =
  | "home"
  | "meds"
  | "medDetail"
  | "diplotype"
  | "risks"
  | "condDetail"
  | "lifestyle"
  | "care"
  | "profile"
  | "share";

export function ReportApp({
  report,
  onLogout,
  onLoadUid,
}: {
  report: DisplayReport;
  onLogout: () => void;
  onLoadUid?: (uid: string) => Promise<void>;
}) {
  const [screen, setScreen] = useState<ScreenName>("home");
  const [previousScreen, setPreviousScreen] = useState<ScreenName>("home");
  const [drugId, setDrugId] = useState<string | null>(null);
  const [condId, setCondId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [defineTerm, setDefineTerm] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const glossary = useMemo(() => buildGlossary(report), [report]);
  const glossaryTerms = useMemo(() => Object.keys(glossary), [glossary]);

  const activeTab: ScreenName =
    screen === "medDetail" || screen === "diplotype"
      ? "meds"
      : screen === "condDetail"
        ? "risks"
        : screen === "share"
          ? previousScreen === "diplotype" || previousScreen === "medDetail"
            ? "meds"
            : previousScreen
          : screen;

  function goShare() {
    setPreviousScreen(screen);
    setScreen("share");
  }

  return (
    <div className="relative mx-auto min-h-screen max-w-md bg-[#f6f4f8] text-[#2b2540]">
      {screen === "home" && (
        <HomeScreen
          report={report}
          goRisks={() => setScreen("risks")}
          goCare={() => setScreen("care")}
          goProfile={() => setScreen("profile")}
          openSearch={() => setSearchOpen(true)}
        />
      )}
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
        <MedicationDetailScreen
          report={report}
          drugId={drugId}
          goBack={() => setScreen("meds")}
          goShare={goShare}
          glossaryTerms={glossaryTerms}
          onDefine={setDefineTerm}
        />
      )}
      {screen === "diplotype" && (
        <DiplotypeScreen report={report} goBack={() => setScreen("meds")} goShare={goShare} onDefine={setDefineTerm} />
      )}
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
        <ConditionDetailScreen
          report={report}
          condId={condId}
          goBack={() => setScreen("risks")}
          glossaryTerms={glossaryTerms}
          onDefine={setDefineTerm}
        />
      )}
      {screen === "lifestyle" && <LifestyleScreen report={report} />}
      {screen === "care" && <CarePlanScreen report={report} />}
      {screen === "profile" && (
        <ProfileScreen report={report} onLogout={onLogout} goShare={goShare} openUpload={() => setUploadOpen(true)} />
      )}
      {screen === "share" && <ShareCardScreen report={report} goBack={() => setScreen(previousScreen)} />}

      {screen !== "share" && <TabBar active={activeTab} onSelect={setScreen} />}

      {searchOpen && (
        <SearchOverlay
          report={report}
          onClose={() => setSearchOpen(false)}
          openDrug={(id) => {
            setDrugId(id);
            setScreen("medDetail");
          }}
          openCondition={(id) => {
            setCondId(id);
            setScreen("condDetail");
          }}
          openDefine={setDefineTerm}
          goLifestyle={() => setScreen("lifestyle")}
        />
      )}

      <DefineSheet term={defineTerm} body={defineTerm ? glossary[defineTerm] ?? "" : ""} onClose={() => setDefineTerm(null)} />

      {uploadOpen && (
        <UploadSheet
          onClose={() => setUploadOpen(false)}
          onUploaded={async (uid) => {
            setUploadOpen(false);
            if (onLoadUid) await onLoadUid(uid);
          }}
        />
      )}
    </div>
  );
}
