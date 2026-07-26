export type RiskLevel = "low" | "mild" | "moderate" | "high";

export const RISK_META: Record<
  RiskLevel,
  { label: string; color: string; bg: string; text: string }
> = {
  low: { label: "Low risk", color: "#2fa36b", bg: "#e3f3ea", text: "#1f7d54" },
  mild: { label: "Mild risk", color: "#c9a227", bg: "#fbf1d8", text: "#a67a12" },
  moderate: {
    label: "Moderate risk",
    color: "#d97b28",
    bg: "#fbe7d6",
    text: "#b35c14",
  },
  high: { label: "High risk", color: "#c0504a", bg: "#f7e0de", text: "#a13a34" },
};

// Order used for the "By risk level" grouping — highest severity first
// (moderate at top, lowest at bottom) since this sample has no "high" entries.
export const RISK_LEVEL_ORDER: RiskLevel[] = ["high", "moderate", "mild", "low"];

export interface Condition {
  id: string;
  name: string;
  system: string;
  risk: RiskLevel;
  tag: string;
  gaugePct: string;
  explain: string;
  mechanism: string;
  genes: { gene: string; variant: string; effect: string }[];
  recs: string[];
}

const groupColors: Record<string, string> = {
  Cardiovascular: "#4e92a8",
  Endocrine: "#e0a93d",
  Neurological: "#4D3F9C",
  Ophthalmic: "#29b6e8",
};

export const CONDITIONS: Condition[] = [
  {
    id: "hypertension",
    name: "Hypertension",
    system: "Cardiovascular",
    risk: "moderate",
    tag: "Blood pressure regulation",
    gaugePct: "58%",
    explain:
      "Your genetic profile shows a moderately elevated predisposition to high blood pressure, driven mostly by variants affecting how your body handles sodium and vascular tone.",
    mechanism:
      "Variants near AGT and ACE influence angiotensin signalling, which regulates blood vessel constriction and sodium retention.",
    genes: [
      { gene: "AGT", variant: "M235T", effect: "Increased angiotensinogen" },
      { gene: "ACE", variant: "I/D", effect: "Higher ACE activity" },
    ],
    recs: [
      "Limit sodium intake to under 2,000mg/day.",
      "Monitor blood pressure at home monthly.",
      "Prioritize regular aerobic exercise.",
    ],
  },
  {
    id: "type2-diabetes",
    name: "Type 2 diabetes",
    system: "Endocrine",
    risk: "mild",
    tag: "Glucose metabolism",
    gaugePct: "38%",
    explain:
      "A mildly elevated genetic risk for insulin resistance over time, most relevant if combined with excess weight or a sedentary lifestyle.",
    mechanism:
      "TCF7L2 variants reduce insulin secretion efficiency from pancreatic beta cells.",
    genes: [{ gene: "TCF7L2", variant: "rs7903146", effect: "Reduced insulin secretion" }],
    recs: [
      "Maintain a healthy body weight.",
      "Get fasting glucose checked annually.",
      "Favor low-glycemic-index carbohydrates.",
    ],
  },
  {
    id: "hypothyroidism",
    name: "Hypothyroidism",
    system: "Endocrine",
    risk: "low",
    tag: "Thyroid function",
    gaugePct: "18%",
    explain:
      "Low genetic likelihood of developing an underactive thyroid based on the variants tested.",
    mechanism: "No significant risk variants detected in thyroid-regulating genes tested.",
    genes: [{ gene: "TSHR", variant: "Wild-type", effect: "Typical receptor function" }],
    recs: ["Routine thyroid panel every few years is sufficient."],
  },
  {
    id: "alzheimers",
    name: "Alzheimer's disease",
    system: "Neurological",
    risk: "moderate",
    tag: "Neurodegeneration",
    gaugePct: "55%",
    explain:
      "Carrying one APOE e4 allele is linked to a moderately increased lifetime risk of late-onset Alzheimer's disease compared to the general population.",
    mechanism:
      "APOE e4 is less efficient at clearing amyloid-beta protein from the brain than the e3 variant.",
    genes: [{ gene: "APOE", variant: "e3/e4", effect: "Reduced amyloid clearance" }],
    recs: [
      "Prioritize cardiovascular health, which is linked to brain health.",
      "Stay cognitively and socially active.",
      "Discuss baseline cognitive screening with your doctor after age 50.",
    ],
  },
  {
    id: "migraine",
    name: "Migraine",
    system: "Neurological",
    risk: "mild",
    tag: "Neurovascular",
    gaugePct: "34%",
    explain: "A mild genetic predisposition toward migraine with aura.",
    mechanism: "Variants near MTHFR are associated with altered neurovascular reactivity.",
    genes: [{ gene: "MTHFR", variant: "C677T", effect: "Altered folate metabolism" }],
    recs: ["Stay hydrated and keep consistent sleep patterns.", "Track potential dietary triggers."],
  },
  {
    id: "amd",
    name: "Age-related macular degeneration",
    system: "Ophthalmic",
    risk: "low",
    tag: "Retinal health",
    gaugePct: "15%",
    explain: "Low genetic risk for age-related macular degeneration.",
    mechanism: "No high-risk CFH or ARMS2 variants detected.",
    genes: [{ gene: "CFH", variant: "Wild-type", effect: "Typical complement regulation" }],
    recs: ["Routine annual eye exams after age 50."],
  },
];

export const RISK_GROUPS_BY_SYSTEM = (() => {
  const order = ["Cardiovascular", "Endocrine", "Neurological", "Ophthalmic"];
  return order
    .map((sys) => ({
      system: sys,
      color: groupColors[sys] || "#8a819c",
      items: CONDITIONS.filter((c) => c.system === sys),
    }))
    .filter((g) => g.items.length);
})();

export const RISK_GROUPS_BY_LEVEL = RISK_LEVEL_ORDER.filter((k) =>
  CONDITIONS.some((c) => c.risk === k)
).map((k) => ({
  key: k,
  label: RISK_META[k].label,
  color: RISK_META[k].color,
  count: CONDITIONS.filter((c) => c.risk === k).length,
  items: CONDITIONS.filter((c) => c.risk === k),
}));

export const RISK_COUNTS = (["low", "mild", "moderate", "high"] as RiskLevel[])
  .map((k) => ({
    level: k,
    label: RISK_META[k].label,
    count: CONDITIONS.filter((c) => c.risk === k).length,
    bg: RISK_META[k].bg,
    text: RISK_META[k].text,
    color: RISK_META[k].color,
  }))
  .filter((r) => r.count > 0);

export interface Drug {
  id: string;
  name: string;
  klass: string;
  category: string;
  gene: string;
  diplotype: string;
  phenotype: string;
  statusKey: "directed" | "caution" | "adjust";
  status: string;
  adjustDirection?: "increase" | "decrease";
  recommendation: string;
}

export const DRUG_CATEGORIES = ["Cardiovascular", "Mental health", "Pain", "Gastrointestinal"];

export const DRUGS: Drug[] = [
  {
    id: "clopidogrel",
    name: "Clopidogrel",
    klass: "Antiplatelet",
    category: "Cardiovascular",
    gene: "CYP2C19",
    diplotype: "*1/*2",
    phenotype: "Intermediate metabolizer",
    statusKey: "caution",
    status: "Use with caution",
    recommendation:
      "Reduced-function CYP2C19 alleles may lower conversion of clopidogrel to its active form. Consider an alternative antiplatelet or dose adjustment.",
  },
  {
    id: "simvastatin",
    name: "Simvastatin",
    klass: "Statin (lipid-lowering)",
    category: "Cardiovascular",
    gene: "SLCO1B1",
    diplotype: "*5/*5",
    phenotype: "Decreased function",
    statusKey: "adjust",
    status: "Adjust dose",
    adjustDirection: "decrease",
    recommendation:
      "Reduced SLCO1B1 transporter activity increases myopathy risk at standard statin doses — a lower dose or an alternative statin is often recommended.",
  },
  {
    id: "warfarin",
    name: "Warfarin",
    klass: "Anticoagulant",
    category: "Cardiovascular",
    gene: "CYP2C9 / VKORC1",
    diplotype: "*1/*3, AA",
    phenotype: "Sensitive",
    statusKey: "caution",
    status: "Use with caution",
    recommendation:
      "Variants in CYP2C9 and VKORC1 suggest sensitivity to warfarin — lower starting doses with closer INR monitoring are typical.",
  },
  {
    id: "citalopram",
    name: "Citalopram",
    klass: "SSRI antidepressant",
    category: "Mental health",
    gene: "CYP2C19",
    diplotype: "*1/*2",
    phenotype: "Intermediate metabolizer",
    statusKey: "caution",
    status: "Use with caution",
    recommendation:
      "Slower clearance may raise blood levels at standard doses — a lower starting dose with QT monitoring is often advised.",
  },
  {
    id: "omeprazole",
    name: "Omeprazole",
    klass: "Proton-pump inhibitor",
    category: "Gastrointestinal",
    gene: "CYP2C19",
    diplotype: "*1/*2",
    phenotype: "Intermediate metabolizer",
    statusKey: "caution",
    status: "Use with caution",
    recommendation:
      "Reduced clearance can raise drug exposure — standard doses are usually still effective, monitor for prolonged effect.",
  },
  {
    id: "sertraline",
    name: "Sertraline",
    klass: "SSRI antidepressant",
    category: "Mental health",
    gene: "CYP2C19",
    diplotype: "*1/*1",
    phenotype: "Normal metabolizer",
    statusKey: "directed",
    status: "Standard dosing",
    recommendation: "Normal metabolizer status expected for this gene — standard dosing applies.",
  },
  {
    id: "ibuprofen",
    name: "Ibuprofen",
    klass: "NSAID",
    category: "Pain",
    gene: "CYP2C9",
    diplotype: "*1/*1",
    phenotype: "Normal metabolizer",
    statusKey: "directed",
    status: "Standard dosing",
    recommendation: "No significant risk variants detected — typical dosing is expected to be well tolerated.",
  },
  {
    id: "codeine",
    name: "Codeine",
    klass: "Opioid analgesic",
    category: "Pain",
    gene: "CYP2D6",
    diplotype: "*1/*4",
    phenotype: "Intermediate metabolizer",
    statusKey: "caution",
    status: "Use with caution",
    recommendation:
      "Reduced conversion to morphine may lessen pain relief at standard doses — discuss alternative analgesics with your prescriber.",
  },
  {
    id: "atorvastatin",
    name: "Atorvastatin",
    klass: "Statin (lipid-lowering)",
    category: "Cardiovascular",
    gene: "SLCO1B1",
    diplotype: "*1/*1",
    phenotype: "Normal function",
    statusKey: "directed",
    status: "Standard dosing",
    recommendation: "No significant SLCO1B1 risk variants detected — typical dosing is expected to be well tolerated.",
  },
];

export const GENE_PANEL = [
  { gene: "CYP2C19", diplotype: "*1/*2", phenotype: "Intermediate metabolizer" },
  { gene: "CYP2C9", diplotype: "*1/*3", phenotype: "Intermediate metabolizer" },
  { gene: "VKORC1", diplotype: "A/A", phenotype: "High sensitivity" },
  { gene: "SLCO1B1", diplotype: "*5/*5", phenotype: "Decreased function" },
  { gene: "CYP2D6", diplotype: "*1/*4", phenotype: "Intermediate metabolizer" },
  { gene: "APOE", diplotype: "e3/e4", phenotype: "One risk allele" },
  { gene: "MTHFR", diplotype: "C/T", phenotype: "Reduced activity" },
];

export const VIT_TIERS = [
  {
    tier: "Essential",
    color: "#1f7d54",
    items: [
      { name: "Vitamin D3", why: "Low VDR receptor sensitivity", dose: "2,000 IU/day" },
      { name: "Folate (methylated)", why: "MTHFR C677T reduced activity", dose: "400mcg/day" },
    ],
  },
  {
    tier: "Recommended",
    color: "#a67a12",
    items: [{ name: "Omega-3", why: "Supports cardiovascular variants", dose: "1,000mg/day" }],
  },
];

export const SENSITIVITIES = [
  { name: "Caffeine", gene: "CYP1A2 slow metabolizer", risk: "moderate" as RiskLevel },
  { name: "Lactose", gene: "MCM6 -13910 C/C", risk: "mild" as RiskLevel },
  { name: "Alcohol flush", gene: "ALDH2 wild-type", risk: "low" as RiskLevel },
];

export const FITNESS_TRAITS = [
  "Endurance-leaning muscle composition (ACTN3 R/X).",
  "Slightly slower recovery — prioritize rest days.",
  "Good VO2 max response to aerobic training.",
];

export const CARE_FREQUENCIES = ["One-time", "Monthly", "Quarterly", "Biannual", "Annual", "As needed"];

export const CARE_PLAN = [
  {
    id: "lipid",
    label: "Lipid profile",
    reason: "Simvastatin · coronary risk",
    cadence: "Every 6 months",
    freq: "Biannual",
    badge: "LP",
    sys: "cv",
  },
  {
    id: "bp",
    label: "Blood pressure check",
    reason: "Hypertension risk",
    cadence: "Every 3 months",
    freq: "Quarterly",
    badge: "BP",
    sys: "cv",
  },
  {
    id: "thyroid",
    label: "TSH / thyroid panel",
    reason: "Hypothyroidism risk",
    cadence: "Annually",
    freq: "Annual",
    badge: "T4",
    sys: "endo",
  },
  {
    id: "a1c",
    label: "HbA1c",
    reason: "Type 2 diabetes tendency",
    cadence: "Every 6 months",
    freq: "Biannual",
    badge: "A1c",
    sys: "endo",
  },
  {
    id: "vitd",
    label: "Vitamin D level",
    reason: "Low baseline · VDR",
    cadence: "Annually",
    freq: "Annual",
    badge: "D",
    sys: "nutri",
  },
  {
    id: "clopidogrel-review",
    label: "Clopidogrel review",
    reason: "CYP2C19 · before procedures",
    cadence: "As needed",
    freq: "As needed",
    badge: "Rx",
    sys: "pgx",
  },
  {
    id: "inr",
    label: "INR check",
    reason: "Only if warfarin is started",
    cadence: "Monthly",
    freq: "Monthly",
    badge: "INR",
    sys: "pgx",
  },
  {
    id: "genetic-counseling",
    label: "Genetic counseling session",
    reason: "Understand your full report",
    cadence: "Once",
    freq: "One-time",
    badge: "GC",
    sys: "pgx",
  },
];

export const PROFILE = {
  name: "Jordan Avery",
  mrn: "GPX-40218",
  test: "Whole-genome",
  sampleCollected: "2026-05-20",
  lab: "GenepowerX · KSU",
};
