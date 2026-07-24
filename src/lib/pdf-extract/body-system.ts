// Static condition-name -> body_system lookup, replacing the LLM
// classification step. The condition panel on these reports is a fixed,
// template-defined set (same glossary every time), so no model judgment is
// needed here — just keep this list in sync if a new condition name shows
// up in a future report (falls back to "Other", never throws).
const BODY_SYSTEM_MAP: Record<string, string> = {
  hypertension: "Cardiovascular",
  "obesity/weight gain": "Metabolic",
  "thyroid disorders": "Endocrine",
  "thyroid (hypo and hyper)": "Endocrine",
  "fatty liver": "Gastrointestinal",
  diabetes: "Endocrine",
  "cholesterol disorders": "Cardiovascular",
  hypertriglyceridemia: "Cardiovascular",
  "coronary artery disease": "Cardiovascular",
  cardiomyopathy: "Cardiovascular",
  gallstones: "Gastrointestinal",
  "mood disorders": "Neurological",
  "mood disorder": "Neurological",
  stroke: "Neurological",
  "musculoskeletal issues": "Musculoskeletal",
  arrhythmias: "Cardiovascular",
  "alzheimer's disease / dementia": "Neurological",
  "chronic kidney disease": "Other",
};

export function bodySystemFor(conditionName: string): string {
  const key = conditionName.trim().toLowerCase();
  return BODY_SYSTEM_MAP[key] ?? "Other";
}
