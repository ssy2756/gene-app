import type { DisplayReport } from "./report-mapping";
import { RISK_LEVEL_ORDER, RISK_META, type Condition, type Drug, type RiskLevel } from "./data";

function mapRiskLevel(key: string): RiskLevel {
  if (key === "high" || key === "moderate" || key === "mild") return key;
  return "low";
}

function gaugePctFor(risk: RiskLevel): string {
  // RISK_LEVEL_ORDER is high-to-low; flip so low sits at the start of the bar.
  const lowToHigh = [...RISK_LEVEL_ORDER].reverse();
  const pos = lowToHigh.indexOf(risk);
  return `${(pos + 0.5) * 25}%`;
}

export function adaptConditions(report: DisplayReport): Condition[] {
  return report.conditions.map((c) => {
    const risk = mapRiskLevel(c.riskKey);
    return {
      id: c.id,
      name: c.name,
      system: c.system,
      risk,
      tag: c.tag || (c.genesAnalyzed ? `${c.genesAnalyzed} genes analyzed` : "Genomic risk"),
      gaugePct: gaugePctFor(risk),
      explain: c.narrative || c.description,
      mechanism: c.description,
      genes: [],
      recs: c.recommendations,
    };
  });
}

// Drug statuses our backend distinguishes ("evidence" = not enough data)
// collapse into "caution" here since this design's Drug type only models
// three buckets (directed/caution/adjust) end to end (icons, labels, badges).
function bucketStatus(statusKey: string): { statusKey: Drug["statusKey"]; adjustDirection?: "increase" | "decrease" } {
  if (statusKey === "adjust") return { statusKey: "adjust" };
  if (statusKey === "directed") return { statusKey: "directed" };
  return { statusKey: "caution" };
}

export function adaptDrugs(report: DisplayReport): Drug[] {
  return report.medications.map((m) => {
    const { statusKey, adjustDirection } = bucketStatus(m.statusKey);
    return {
      id: m.id,
      name: m.name,
      klass: m.klass,
      category: m.klass || m.system || "Other",
      gene: m.gene,
      diplotype: m.diplotype,
      phenotype: m.phenotype,
      statusKey,
      status: m.status,
      adjustDirection,
      recommendation: m.recommendation,
    };
  });
}

export function adaptDrugCategories(drugs: Drug[]): string[] {
  return [...new Set(drugs.map((d) => d.category).filter(Boolean))];
}

export function adaptGenePanel(report: DisplayReport) {
  return report.genePanel.map((g) => ({ gene: g.gene, diplotype: g.diplotype, phenotype: g.phenotype }));
}

const VIT_TIER_COLORS: Record<string, string> = {
  essential: "#1f7d54",
  advised: "#a67a12",
  optional: "#6a6478",
};

export function adaptVitTiers(report: DisplayReport) {
  return report.vitamins.map((t) => ({
    tier: t.tier,
    color: VIT_TIER_COLORS[t.tier.trim().toLowerCase()] ?? "#8a8394",
    items: t.items,
  }));
}

function riskKeyFromLabel(level: string): RiskLevel {
  const s = level.toLowerCase();
  if (s.includes("high")) return "high";
  if (s.includes("moderate")) return "moderate";
  if (s.includes("mild")) return "mild";
  return "low";
}

export function adaptSensitivities(report: DisplayReport) {
  return report.sensitivities.map((s) => ({
    name: s.name,
    gene: s.gene,
    risk: riskKeyFromLabel(s.level),
  }));
}

export function adaptFitnessTraits(report: DisplayReport): string[] {
  const { headline, sub, tips } = report.fitness;
  const summary = [headline, sub].filter(Boolean).join(": ");
  return [...(summary ? [summary] : []), ...tips];
}

export function adaptProfile(report: DisplayReport) {
  return {
    name: report.patient.name,
    mrn: report.uid,
    test: report.patient.sequencingType !== "—" ? report.patient.sequencingType : report.patient.method,
    sampleCollected: report.patient.collectionDate,
    lab: "GenepowerX",
  };
}

export interface CarePlanItem {
  id: string;
  label: string;
  reason: string;
  category: string;
}

export function adaptCarePlan(report: DisplayReport): CarePlanItem[] {
  const items: CarePlanItem[] = [];
  report.carePlan.forEach((c) => {
    c.checks.forEach((check, i) => {
      items.push({
        id: `${c.id}-${i}`,
        label: check.reason,
        reason: `${c.name} · ${check.cadence}`,
        category: c.name,
      });
    });
  });
  return items;
}

export function carePlanCategories(items: CarePlanItem[]): string[] {
  return [...new Set(items.map((i) => i.category))];
}

const CATEGORY_PALETTE = [
  { bg: "#e8eef2", color: "#4e92a8" },
  { bg: "#fbf1d8", color: "#a67a12" },
  { bg: "#e3f3ea", color: "#1f7d54" },
  { bg: "#f3eef9", color: "#4D3F9C" },
  { bg: "#fbe7d6", color: "#b35c14" },
  { bg: "#f7e0de", color: "#a13a34" },
];

export function styleForCategory(category: string, categories: string[]) {
  const idx = categories.indexOf(category);
  return CATEGORY_PALETTE[idx >= 0 ? idx % CATEGORY_PALETTE.length : 0];
}

export function badgeForCategory(category: string): string {
  const words = category.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return category.slice(0, 2).toUpperCase();
}

export function riskCountsFor(conditions: Condition[]) {
  return (["low", "mild", "moderate", "high"] as RiskLevel[])
    .map((k) => ({
      level: k,
      label: RISK_META[k].label,
      count: conditions.filter((c) => c.risk === k).length,
      bg: RISK_META[k].bg,
      text: RISK_META[k].text,
      color: RISK_META[k].color,
    }))
    .filter((r) => r.count > 0);
}

export function riskGroupsBySystem(conditions: Condition[]) {
  const systems = [...new Set(conditions.map((c) => c.system))];
  return systems
    .map((system) => ({
      system,
      color: "#4D3F9C",
      items: conditions.filter((c) => c.system === system),
    }))
    .filter((g) => g.items.length);
}

export function riskGroupsByLevel(conditions: Condition[]) {
  return RISK_LEVEL_ORDER.filter((k) => conditions.some((c) => c.risk === k)).map((k) => ({
    key: k,
    label: RISK_META[k].label,
    color: RISK_META[k].color,
    count: conditions.filter((c) => c.risk === k).length,
    items: conditions.filter((c) => c.risk === k),
  }));
}
