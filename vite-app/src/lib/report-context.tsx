import { createContext, useContext, useMemo } from "react";
import type { DisplayReport } from "./report-mapping";
import {
  adaptConditions,
  adaptDrugs,
  adaptDrugCategories,
  adaptGenePanel,
  adaptVitTiers,
  adaptSensitivities,
  adaptFitnessTraits,
  adaptProfile,
  adaptCarePlan,
  carePlanCategories,
  riskCountsFor,
  riskGroupsBySystem,
  riskGroupsByLevel,
  type CarePlanItem,
} from "./reportAdapter";
import type { Condition, Drug } from "./data";

interface ReportData {
  conditions: Condition[];
  drugs: Drug[];
  drugCategories: string[];
  genePanel: ReturnType<typeof adaptGenePanel>;
  vitTiers: ReturnType<typeof adaptVitTiers>;
  sensitivities: ReturnType<typeof adaptSensitivities>;
  fitnessTraits: string[];
  profile: ReturnType<typeof adaptProfile>;
  riskCounts: ReturnType<typeof riskCountsFor>;
  riskGroupsBySystem: ReturnType<typeof riskGroupsBySystem>;
  riskGroupsByLevel: ReturnType<typeof riskGroupsByLevel>;
  carePlan: CarePlanItem[];
  carePlanCategories: string[];
}

const ReportDataContext = createContext<ReportData | null>(null);

export function ReportDataProvider({ report, children }: { report: DisplayReport; children: React.ReactNode }) {
  const data = useMemo<ReportData>(() => {
    const conditions = adaptConditions(report);
    const drugs = adaptDrugs(report);
    const carePlan = adaptCarePlan(report);
    return {
      conditions,
      drugs,
      drugCategories: adaptDrugCategories(drugs),
      genePanel: adaptGenePanel(report),
      vitTiers: adaptVitTiers(report),
      sensitivities: adaptSensitivities(report),
      fitnessTraits: adaptFitnessTraits(report),
      profile: adaptProfile(report),
      riskCounts: riskCountsFor(conditions),
      riskGroupsBySystem: riskGroupsBySystem(conditions),
      riskGroupsByLevel: riskGroupsByLevel(conditions),
      carePlan,
      carePlanCategories: carePlanCategories(carePlan),
    };
  }, [report]);

  return <ReportDataContext.Provider value={data}>{children}</ReportDataContext.Provider>;
}

export function useReportData() {
  const ctx = useContext(ReportDataContext);
  if (!ctx) throw new Error("useReportData must be used within ReportDataProvider");
  return ctx;
}
