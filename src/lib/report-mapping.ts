// Maps the raw parsed-PDF JSON (validated against `reportDataSchema` in
// report-schema.ts) down to the view models the UI screens in
// src/components/report/ actually render. The UI was built from the
// GenepowerX app prototype (design upload); this file is the bridge between
// that fixed screen shape and whatever the real report JSON contains.
//
// Several report sections (vitamins_and_minerals, pharmacogenomics fields
// beyond molecule_class/drug, food_sensitivity, etc.) were only loosely
// specified in the schema file the user provided ("..." placeholders), so
// the getters below read several plausible field-name aliases and fall back
// to sane defaults rather than throwing — real report data may use slightly
// different key names than guessed here, in which case only the alias
// lists below need updating, not the components.

export type RawReport = Record<string, unknown>;

type RiskKey = "low" | "mild" | "moderate" | "high" | "unknown";

const RISK_STYLES: Record<RiskKey, { label: string; color: string; bg: string; text: string; pct: string }> = {
  low: { label: "Low", color: "#2fa36b", bg: "#e3f3ea", text: "#1f7d54", pct: "22%" },
  mild: { label: "Mild", color: "#c9a227", bg: "#f6f1dc", text: "#8a7320", pct: "42%" },
  moderate: { label: "Moderate", color: "#d97b28", bg: "#fbe8d5", text: "#a85e18", pct: "66%" },
  high: { label: "High", color: "#c0504a", bg: "#f6e4e2", text: "#a5433c", pct: "88%" },
  unknown: { label: "Not assessed", color: "#8a8394", bg: "#eceaef", text: "#6a6478", pct: "8%" },
};

function normalizeRiskKey(raw: unknown): RiskKey {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s.includes("high")) return "high";
  if (s.includes("moderate")) return "moderate";
  if (s.includes("mild")) return "mild";
  if (s.includes("low")) return "low";
  return "unknown";
}

type DrugStatusKey = "directed" | "caution" | "adjust" | "evidence";

const STATUS_STYLES: Record<
  DrugStatusKey,
  { status: string; short: string; color: string; pillBg: string; pillText: string; bannerBg: string; bannerBorder: string }
> = {
  directed: { status: "Use as Directed", short: "Directed", color: "#2fa36b", pillBg: "#e3f3ea", pillText: "#1f7d54", bannerBg: "#eef7f1", bannerBorder: "#cfe8d9" },
  caution: { status: "Use with Caution", short: "Caution", color: "#e0a93d", pillBg: "#fbf1d8", pillText: "#a67a12", bannerBg: "#fdf6e7", bannerBorder: "#f0e2bf" },
  adjust: { status: "Adjust Dose", short: "Adjust", color: "#d97b28", pillBg: "#fbe8d5", pillText: "#a85e18", bannerBg: "#fdf0e4", bannerBorder: "#f2ddc4" },
  evidence: { status: "Not Enough Evidence", short: "No data", color: "#8a8394", pillBg: "#eceaef", pillText: "#6a6478", bannerBg: "#f4f2f6", bannerBorder: "#e4e0ea" },
};

function normalizeStatusKey(raw: unknown): DrugStatusKey {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s.includes("adjust")) return "adjust";
  if (s.includes("caution") || s.includes("moderate")) return "caution";
  if (s.includes("not enough") || s.includes("no data") || s.includes("insufficient")) return "evidence";
  return "directed";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function pick(obj: unknown, keys: string[]): unknown {
  if (!isRecord(obj)) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}

const CADENCE_PATTERNS: Array<[RegExp, string]> = [
  [/every\s*3\s*months|quarterly/i, "Every 3 months"],
  [/every\s*6\s*months|biannual|twice a year/i, "Every 6 months"],
  [/every\s*(12|year)\s*months|annually|yearly|once a year/i, "Annually"],
  [/monthly/i, "Monthly"],
  [/one[\s-]?time/i, "One-time"],
  [/as needed|prn/i, "As needed"],
];

function extractCadence(text: string): string {
  for (const [re, label] of CADENCE_PATTERNS) {
    if (re.test(text)) return label;
  }
  return "As advised";
}

// ---------- patient / profile ----------

export type PatientInfoView = {
  name: string;
  age: string;
  gender: string;
  sampleType: string;
  collectionDate: string;
  sequencingType: string;
  method: string;
};

function mapPatientInfo(raw: RawReport): PatientInfoView {
  const pi = raw.patient_information;
  const sample = isRecord(pi) ? pi.sample_details : undefined;
  const seq = isRecord(pi) ? pi.sequencing_details : undefined;
  return {
    name: str(pick(pi, ["name"]), "—"),
    age: str(pick(pi, ["age"]), "—"),
    gender: str(pick(pi, ["gender"]), "—"),
    sampleType: str(pick(sample, ["type_of_sample", "sample_type"]), "—"),
    collectionDate: str(pick(sample, ["collection_date"]), "—"),
    sequencingType: str(pick(seq, ["sequencing_type"]), "—"),
    method: str(pick(seq, ["method", "wgs_wes_targeted_seq"]), "—"),
  };
}

// ---------- conditions (condition_risk_overview + medical_recommendations merged) ----------

export type ConditionView = {
  id: string;
  name: string;
  system: string;
  tag: string;
  riskKey: RiskKey;
  riskLabel: string;
  color: string;
  bg: string;
  text: string;
  gaugePct: string;
  genesAnalyzed: number | null;
  description: string;
  narrative: string;
  recommendations: string[];
};

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "condition";
}

function mapConditions(raw: RawReport): ConditionView[] {
  const overview = asArray(raw.condition_risk_overview).filter(isRecord);
  const recs = asArray(raw.medical_recommendations).filter(isRecord);

  const byName = new Map<string, Record<string, unknown>>();
  for (const r of recs) {
    const name = str(pick(r, ["condition"])).trim().toLowerCase();
    if (name) byName.set(name, r);
  }

  const seen = new Set<string>();
  const merged: ConditionView[] = [];

  for (const o of overview) {
    const name = str(pick(o, ["condition"]), "Condition");
    const key = name.trim().toLowerCase();
    seen.add(key);
    const rec = byName.get(key);
    const riskKey = normalizeRiskKey(pick(rec, ["risk_level"]) ?? pick(o, ["risk_level"]));
    const style = RISK_STYLES[riskKey];
    merged.push({
      id: slugify(name),
      name,
      system: str(pick(o, ["system", "category"]), "General"),
      tag: str(pick(o, ["tag"]), ""),
      riskKey,
      riskLabel: style.label,
      color: style.color,
      bg: style.bg,
      text: style.text,
      gaugePct: style.pct,
      genesAnalyzed: typeof pick(o, ["genes_analyzed"]) === "number" ? (o.genes_analyzed as number) : null,
      description: str(pick(o, ["description"])),
      narrative: str(pick(rec, ["narrative"])),
      recommendations: asArray(pick(rec, ["recommendations"])).map((r) => str(r)),
    });
  }

  // Conditions that only appear in medical_recommendations (no overview entry)
  for (const r of recs) {
    const name = str(pick(r, ["condition"]), "Condition");
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const riskKey = normalizeRiskKey(pick(r, ["risk_level"]));
    const style = RISK_STYLES[riskKey];
    merged.push({
      id: slugify(name),
      name,
      system: "General",
      tag: "",
      riskKey,
      riskLabel: style.label,
      color: style.color,
      bg: style.bg,
      text: style.text,
      gaugePct: style.pct,
      genesAnalyzed: null,
      description: "",
      narrative: str(pick(r, ["narrative"])),
      recommendations: asArray(pick(r, ["recommendations"])).map((x) => str(x)),
    });
  }

  return merged;
}

// ---------- medications (pharmacogenomics) ----------

export type GenePanelEntryView = {
  gene: string;
  diplotype: string;
  phenotype: string;
  statusKey: DrugStatusKey;
  color: string;
};

export type MedicationView = {
  id: string;
  name: string;
  system: string;
  klass: string;
  gene: string;
  diplotype: string;
  phenotype: string;
  statusKey: DrugStatusKey;
  status: string;
  short: string;
  color: string;
  pillBg: string;
  pillText: string;
  bannerBg: string;
  bannerBorder: string;
  evidence: string;
  recommendation: string;
};

function mapGenePanel(raw: RawReport): GenePanelEntryView[] {
  const pgx = raw.pharmacogenomics;
  const diplotypes = asArray(isRecord(pgx) ? pgx.diplotypes : undefined).filter(isRecord);
  return diplotypes.map((d) => {
    const phenotype = str(pick(d, ["phenotype", "metabolizer_status"]), "—");
    const statusKey = normalizeStatusKey(pick(d, ["status", "action"]) ?? phenotype);
    return {
      gene: str(pick(d, ["gene"]), "—"),
      diplotype: str(pick(d, ["diplotype", "genotype"]), "—"),
      phenotype,
      statusKey,
      color: STATUS_STYLES[statusKey].color,
    };
  });
}

function mapMedications(raw: RawReport): MedicationView[] {
  const pgx = raw.pharmacogenomics;
  const drugRecs = asArray(isRecord(pgx) ? pgx.drug_recommendations : undefined).filter(isRecord);
  return drugRecs.map((d, i) => {
    const name = str(pick(d, ["drug"]), `Medication ${i + 1}`);
    const phenotype = str(pick(d, ["phenotype", "metabolizer_status"]), "—");
    const statusKey = normalizeStatusKey(pick(d, ["status", "action", "recommendation_level"]) ?? phenotype);
    const style = STATUS_STYLES[statusKey];
    return {
      id: slugify(name),
      name,
      system: str(pick(d, ["system", "category"]), "General"),
      klass: str(pick(d, ["molecule_class", "drug_class"]), "—"),
      gene: str(pick(d, ["gene"]), "—"),
      diplotype: str(pick(d, ["diplotype", "genotype"]), "—"),
      phenotype,
      statusKey,
      status: style.status,
      short: style.short,
      color: style.color,
      pillBg: style.pillBg,
      pillText: style.pillText,
      bannerBg: style.bannerBg,
      bannerBorder: style.bannerBorder,
      evidence: str(pick(d, ["evidence_level", "evidence"]), "—"),
      recommendation: str(pick(d, ["recommendation", "narrative", "notes"]), "No specific action noted."),
    };
  });
}

// ---------- lifestyle: vitamins, sensitivities, fitness ----------

export type VitaminTierView = {
  tier: string;
  color: string;
  items: { name: string; why: string; dose: string }[];
};

const TIER_COLORS: Record<string, string> = {
  essential: "#c0504a",
  advised: "#e0a93d",
  optional: "#2fa36b",
};

function tierColor(tier: string): string {
  return TIER_COLORS[tier.trim().toLowerCase()] ?? "#8a8394";
}

function mapVitaminItem(v: unknown): { name: string; why: string; dose: string } {
  return {
    name: str(pick(v, ["name", "nutrient"]), "—"),
    why: str(pick(v, ["why", "reason", "gene"]), ""),
    dose: str(pick(v, ["dose", "dosage"]), "—"),
  };
}

// Groups a flat array of vitamin items by each item's own "tier" field
// (falling back to "General" for items with no tier of their own).
function groupByOwnTier(items: unknown[]): VitaminTierView[] {
  const groups = new Map<string, { name: string; why: string; dose: string }[]>();
  for (const v of items) {
    const tier = str(pick(v, ["tier"]), "General");
    const list = groups.get(tier) ?? [];
    list.push(mapVitaminItem(v));
    groups.set(tier, list);
  }
  return [...groups.entries()].map(([tier, tierItems]) => ({ tier, color: tierColor(tier), items: tierItems }));
}

// Tiers must always display in this clinical order regardless of the
// order keys happened to appear in the parsed JSON (object key order
// just reflects whatever order the model emitted them in, which varies).
const TIER_DISPLAY_ORDER = ["essential", "advised", "optional"];

function sortByTierOrder(tiers: VitaminTierView[]): VitaminTierView[] {
  return [...tiers].sort((a, b) => {
    const ai = TIER_DISPLAY_ORDER.indexOf(a.tier.trim().toLowerCase());
    const bi = TIER_DISPLAY_ORDER.indexOf(b.tier.trim().toLowerCase());
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function mapVitamins(raw: RawReport): VitaminTierView[] {
  const vm = raw.vitamins_and_minerals;
  if (Array.isArray(vm)) {
    return sortByTierOrder(groupByOwnTier(vm));
  }
  if (isRecord(vm)) {
    // A generic "items"/"list" key means the array is wrapped in a single
    // envelope object rather than keyed by tier — group those by each
    // item's own "tier" field, same as the flat-array case, rather than
    // treating the wrapper key itself as a (wrong) single tier name.
    const genericKey = ["items", "list", "vitamins", "nutrients"].find((k) => Array.isArray(vm[k]));
    if (genericKey) {
      return sortByTierOrder(groupByOwnTier(vm[genericKey] as unknown[]));
    }
    return sortByTierOrder(
      Object.entries(vm)
        .filter(([, v]) => Array.isArray(v))
        .map(([tier, v]) => ({
          tier,
          color: tierColor(tier),
          items: (v as unknown[]).map(mapVitaminItem),
        }))
    );
  }
  return [];
}

export type SensitivityView = {
  name: string;
  gene: string;
  level: string;
  bg: string;
  text: string;
};

// Flattens a per-item "recommendations" field into a string array, whether
// it's already an array of strings, an array of objects, or a single string.
function flattenRecommendations(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((r) => (isRecord(r) ? str(pick(r, ["recommendation", "narrative", "note", "text"]), "") : str(r))).filter(Boolean);
  }
  if (typeof v === "string" && v) return [v];
  return [];
}

function mapSensitivities(raw: RawReport): SensitivityView[] {
  const fn = raw.fitness_and_nutrigenomics;
  const list = asArray(isRecord(fn) ? fn.food_sensitivity : undefined).filter(isRecord);
  return list.map((s) => {
    const riskKey = normalizeRiskKey(pick(s, ["risk", "level", "risk_level"]));
    const style = RISK_STYLES[riskKey];
    return {
      // Real reports label each sensitivity via "type" (e.g. "Lactose
      // Intolerance"), not "name"/"food" — check that first.
      name: str(pick(s, ["type", "name", "food"]), "—"),
      gene: str(pick(s, ["gene", "narrative"]), ""),
      level: str(pick(s, ["level", "result", "risk_level"]), riskKey === "unknown" ? "" : style.label),
      bg: style.bg,
      text: style.text,
    };
  });
}

function mapFitness(raw: RawReport): { headline: string; sub: string; tips: string[] } {
  const fn = raw.fitness_and_nutrigenomics;
  const musculo = isRecord(fn) ? fn.musculoskeletal : undefined;
  // "exercise" is the current schema field name; "metabolism" is kept as a
  // fallback alias for any report ingested before the rename.
  const exercise = asArray(isRecord(fn) ? (fn.exercise ?? fn.metabolism) : undefined).filter(isRecord);
  const musculoTips = flattenRecommendations(isRecord(musculo) ? musculo.recommendations : undefined);
  const exerciseTips = exercise.flatMap((m) => {
    const own = flattenRecommendations(m.recommendations);
    if (own.length) return own;
    // Fall back to the item's own narrative/type if it has no
    // recommendations array of its own.
    const fallback = str(pick(m, ["recommendation", "narrative", "note"]), "");
    return fallback ? [fallback] : [];
  });
  // Real reports describe the musculoskeletal profile via "narrative"/
  // "risk_level" only, no dedicated headline field — use the risk_level as
  // a short label and the narrative as the supporting detail line.
  const risk = str(pick(musculo, ["risk_level", "level"]), "");
  const narrative = str(pick(musculo, ["narrative", "detail", "genes"]), "");
  return {
    headline: str(pick(musculo, ["profile", "type"]), risk || "Fitness profile"),
    sub: narrative,
    tips: [...musculoTips, ...exerciseTips],
  };
}

// ---------- care plan (derived from medical_recommendations, grouped by condition) ----------

export type CarePlanCheckView = {
  reason: string;
  cadence: string;
};

export type CarePlanConditionView = {
  id: string;
  name: string;
  badge: string;
  color: string;
  bg: string;
  text: string;
  checks: CarePlanCheckView[];
};

// Category badge colors lifted directly from the mockup's care-plan icon map
// (cv/endo/nutri/pgx) — kept independent of risk-level color so a low-risk
// condition's care items don't look "green/safe" out of context.
const CARE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  Cardiovascular: { bg: "#e8eef2", text: "#4e92a8" },
  Endocrine: { bg: "#fbf1d8", text: "#a67a12" },
  Metabolic: { bg: "#e3f3ea", text: "#1f7d54" },
  Neurological: { bg: "#f3eef9", text: "#4D3F9C" },
  Ophthalmic: { bg: "#e8eef2", text: "#4e92a8" },
};
const CARE_BADGE_DEFAULT = { bg: "#f0ecf4", text: "#6a6478" };

function mapCarePlan(conditions: ConditionView[]): CarePlanConditionView[] {
  return conditions
    .filter((c) => c.recommendations.length > 0)
    .map((c) => {
      const badgeColor = CARE_BADGE_COLORS[c.system] ?? CARE_BADGE_DEFAULT;
      return {
        id: c.id,
        name: c.name,
        badge: c.name.slice(0, 2).toUpperCase(),
        color: badgeColor.text,
        bg: badgeColor.bg,
        text: badgeColor.text,
        checks: c.recommendations.map((r) => ({ reason: r, cadence: extractCadence(r) })),
      };
    });
}

// ---------- home summary ----------

export type HomeSummaryView = {
  conditionsTotal: number;
  riskCounts: { level: RiskKey; label: string; count: number; bg: string; text: string; color: string }[];
  medsTotal: number;
  medsFlaggedCount: number;
};

function mapHomeSummary(conditions: ConditionView[], medications: MedicationView[]): HomeSummaryView {
  const tally: Record<RiskKey, number> = { low: 0, mild: 0, moderate: 0, high: 0, unknown: 0 };
  conditions.forEach((c) => {
    tally[c.riskKey]++;
  });
  const riskCounts = (["low", "mild", "moderate", "high"] as RiskKey[]).map((level) => ({
    level,
    label: RISK_STYLES[level].label,
    count: tally[level],
    bg: RISK_STYLES[level].bg,
    text: RISK_STYLES[level].text,
    color: RISK_STYLES[level].color,
  }));
  return {
    conditionsTotal: conditions.length,
    riskCounts,
    medsTotal: medications.length,
    medsFlaggedCount: medications.filter((m) => m.statusKey === "caution" || m.statusKey === "adjust").length,
  };
}

// ---------- top-level view model consumed by <ReportApp> ----------

export type DisplayReport = {
  uid: string;
  patient: PatientInfoView;
  conditions: ConditionView[];
  medications: MedicationView[];
  genePanel: GenePanelEntryView[];
  vitamins: VitaminTierView[];
  sensitivities: SensitivityView[];
  fitness: { headline: string; sub: string; tips: string[] };
  carePlan: CarePlanConditionView[];
  home: HomeSummaryView;
};

export function mapReportForDisplay(uid: string, raw: RawReport): DisplayReport {
  const conditions = mapConditions(raw);
  const medications = mapMedications(raw);
  return {
    uid,
    patient: mapPatientInfo(raw),
    conditions,
    medications,
    genePanel: mapGenePanel(raw),
    vitamins: mapVitamins(raw),
    sensitivities: mapSensitivities(raw),
    fitness: mapFitness(raw),
    carePlan: mapCarePlan(conditions),
    home: mapHomeSummary(conditions, medications),
  };
}
