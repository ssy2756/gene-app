function cleanFooter(s: string): string {
  return s.replace(/This Report is Confidential and belongs to:?\s*Pateint\s*Name/gi, "").trim();
}

// ---- Personal information (page 1) ----

export function parsePersonalInformation(lines: string[]) {
  const get = (label: string) => {
    const l = lines.find((x) => x.startsWith(label));
    return l ? l.slice(label.length).trim() || null : null;
  };
  const nameGenderLine = lines.find((l) => /^Name:/i.test(l)) ?? "";
  const nameMatch = nameGenderLine.match(/^Name:(.*?)(?:Age:|$)/i);
  const genderMatch = nameGenderLine.match(/Gender:\s*(\S+)/i);
  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    gender: genderMatch ? genderMatch[1].trim() : null,
    sample_details: {
      collection_date: get("Collection Date"),
      type_of_sample: get("Type of sample"),
      genomic_specimen_id: get("Genomic Specimen ID"),
    },
    sequencing_details: {
      sequencing_type: get("Sequencing Type"),
      method: get("WGS/WES/Targeted Seq"),
      mean_sequencing_depth: get("Mean Sequencing Depth (x)"),
      encoding: get("Encoding"),
      sequence_length: get("Sequence length"),
      overall_alignment_rate: get("Overall Alignment Rate (%)"),
      q30_score: get("Q30 score (%)"),
    },
  };
}

// ---- Condition glossary (genes-analyzed counts) ----
// The glossary page runs condition name straight into its description text
// with no separator ("DiabetesA condition where...") and wraps multi-word
// names across lines ("Coronary Artery\nDisease"), so a generic "name
// immediately before Genes-(N)" regex doesn't reliably recover the name.
// Instead: anchor on each condition name we already know about (from the
// narrative parser, which extracts clean names reliably) by searching for
// it directly in the glossary text, then take the nearest following
// "Genes-(N)"/"Genes–(N)" match.
const GLOSSARY_NAME_ALIASES: Record<string, string> = {
  "cholesterol disorders": "hypertriglyceridemia",
  "mood disorders": "mood disorder",
  "thyroid disorders": "thyroid",
};

export function findGenesAnalyzed(glossaryText: string, conditionName: string): number | null {
  const key = conditionName.trim().toLowerCase();
  const searchTerm = GLOSSARY_NAME_ALIASES[key] ?? key;
  const idx = glossaryText.toLowerCase().indexOf(searchTerm);
  if (idx === -1) return null;
  const window = glossaryText.slice(idx, idx + 400);
  const m = window.match(/Genes\s*[-–]\s*\((\d+)\)/i);
  return m ? Number(m[1]) : null;
}

// ---- Medical concerns (condition risk narrative, pages 6-11 + fitness page 21) ----

export interface ConditionNarrative {
  condition: string;
  risk_level: string;
  narrative: string;
  recommendations: string[];
}

export function parseMedicalConcerns(pagesLines: string[][]): ConditionNarrative[] {
  const results: ConditionNarrative[] = [];
  for (const lines of pagesLines) {
    const text = cleanFooter(lines.join("\n"));
    const re = /You have (Low|Mild|Moderate|High) genetic risk for ([^.]+)\./gi;
    const matches = [...text.matchAll(re)];
    for (let i = 0; i < matches.length; i++) {
      const risk_level = matches[i][1];
      const condition = matches[i][2].trim();
      const start = matches[i].index!;
      const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const block = text.slice(start, end);
      const bulletStart = block.search(/•/);
      const narrative = (bulletStart >= 0 ? block.slice(0, bulletStart) : block).replace(/\n/g, " ").trim();
      const recommendations =
        bulletStart >= 0
          ? block
              .slice(bulletStart)
              .split("•")
              .map((s) => s.replace(/\n/g, " ").trim())
              .filter(Boolean)
          : [];
      results.push({ condition, risk_level, narrative, recommendations });
    }
  }
  return results;
}

// ---- Food sensitivity / metabolism (pages 19-20) ----

export interface FoodSensitivityItem {
  name: string;
  risk_level: string | null;
  narrative: string;
  recommendations: string[];
}

export function parseFoodSensitivityMetabolism(pagesLines: string[][]): FoodSensitivityItem[] {
  const text = cleanFooter(pagesLines.map((l) => l.join("\n")).join("\n"));
  const categoryRe = /^([A-Z][a-zA-Z ]+(?:Intolerance|Resistance))$/gm;
  const matches = [...text.matchAll(categoryRe)];
  const results: FoodSensitivityItem[] = [];
  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].trim();
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const block = text.slice(start, end).trim();
    const recIdx = block.search(/Recommendations:/i);
    const narrative = (recIdx >= 0 ? block.slice(0, recIdx) : block).replace(/\n/g, " ").trim();
    const recsBlock = recIdx >= 0 ? block.slice(recIdx + "Recommendations:".length) : "";
    const recommendations = recsBlock
      .split("•")
      .map((s) => s.replace(/\n/g, " ").trim())
      .filter(Boolean);
    const riskMatch = block.match(/\b(low|mild|moderate|high)\b.{0,20}\brisk\b/i) || block.match(/\brisk\b.{0,20}\b(low|mild|moderate|high)\b/i);
    results.push({ name, risk_level: riskMatch ? riskMatch[1].toLowerCase() : null, narrative, recommendations });
  }
  return results;
}

// ---- Fitness page (21): Exercise subsection + Musculoskeletal narrative ----

export function parseExercise(lines: string[]): string[] {
  const text = cleanFooter(lines.join("\n"));
  const exIdx = text.search(/^Exercise:/m);
  if (exIdx < 0) return [];
  const block = text.slice(exIdx + "Exercise:".length);
  return block
    .split(/[•\n]/)
    .map((s) => s.trim())
    .filter((s) => s && !/^This Report/i.test(s));
}

export interface MusculoskeletalNarrative {
  condition: string;
  risk_level: string;
  narrative: string;
  recommendations: string[];
}

export function parseMusculoskeletal(lines: string[]): MusculoskeletalNarrative | null {
  const text = cleanFooter(lines.join("\n"));
  const m = text.match(/You have (Low|Mild|Moderate|High) genetic risk for (Musculoskeletal Issues)\./i);
  if (!m) return null;
  const risk_level = m[1];
  const condition = m[2];
  const afterMatch = text.slice(m.index! + m[0].length);
  const medRecIdx = afterMatch.search(/Medical Recommendations:/i);
  const narrative = (medRecIdx >= 0 ? afterMatch.slice(0, medRecIdx) : afterMatch.slice(0, 400)).replace(/\n/g, " ").trim();
  const dietIdx = afterMatch.search(/Diet and Nutrition:/i);
  const recsBlock = medRecIdx >= 0 ? afterMatch.slice(medRecIdx + "Medical Recommendations:".length, dietIdx >= 0 ? dietIdx : undefined) : "";
  const recommendations = recsBlock
    .split("•")
    .map((s) => s.replace(/\n/g, " ").trim())
    .filter(Boolean);
  return { condition, risk_level, narrative, recommendations };
}

// ---- Vitamins tiers (page 22) ----

export function parseVitaminsTiers(lines: string[]): { name: string; dose: string; tier: string }[] {
  const results: { name: string; dose: string; tier: string }[] = [];
  let currentTier: string | null = null;
  const tierRe = /^(Essential|Advised|Optional)\b/i;
  const itemRe = /([A-Za-z][A-Za-z0-9\- ]{1,45}?)\s*\(([^)]{1,20})\)/g;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const tm = tierRe.exec(line);
    if (tm) {
      currentTier = tm[1][0].toUpperCase() + tm[1].slice(1).toLowerCase();
      continue;
    }
    if (!currentTier) continue;
    for (const m of line.matchAll(itemRe)) {
      results.push({ name: m[1].trim(), dose: m[2].trim(), tier: currentTier });
    }
  }
  return results;
}

// ---- Diet plan (pages 59-61) ----

export function parseDietPlan(pagesLines: string[][]): { heading: string; recommendations: string[] }[] {
  const sections: { heading: string; recommendations: string[] }[] = [];
  const text = cleanFooter(pagesLines.map((l) => l.join("\n")).join("\n"));
  const headingRe = /^FOR YOUR [A-Z ]+:$/gm;
  const matches = [...text.matchAll(headingRe)];
  for (let i = 0; i < matches.length; i++) {
    const heading = matches[i][0].replace(/:$/, "");
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const block = text.slice(start, end);
    const recommendations = block
      .split("•")
      .map((s) => s.replace(/\n/g, " ").trim())
      .filter(Boolean);
    sections.push({ heading, recommendations });
  }
  return sections;
}

// ---- Immune health (pages 13-14) ----

export function parseImmuneHealth(pagesLines: string[][]) {
  const text = cleanFooter(pagesLines.map((l) => l.join("\n")).join("\n"));
  const testResultMatch = text.match(/TEST RESULT\s*\n?([\s\S]*?)(?:VARIANT DETAILS|$)/i);
  const test_result = testResultMatch ? testResultMatch[1].replace(/\n/g, " ").trim() : null;

  const variantIdx = text.search(/VARIANT DETAILS/i);
  const clinIdx = text.search(/CLINICAL RECOMMENDATIONS/i);
  const variant_details =
    variantIdx >= 0
      ? text
          .slice(variantIdx, clinIdx >= 0 ? clinIdx : undefined)
          .split("•")
          .slice(1)
          .map((s) => s.replace(/\n/g, " ").trim())
          .filter(Boolean)
      : [];
  const recommendations =
    clinIdx >= 0
      ? text
          .slice(clinIdx)
          .split("•")
          .slice(1)
          .map((s) => s.replace(/\n/g, " ").trim())
          .filter(Boolean)
      : [];

  return { test_result, variant_details, recommendations };
}

// ---- Hereditary cancer screening (page 16) ----

export function parseHereditaryCancer(lines: string[]) {
  const text = cleanFooter(lines.join("\n"));
  const testResultMatch = text.match(/Test Result\s*\n?([\s\S]*?)(?:Recommendations:|$)/i);
  const test_result = testResultMatch ? testResultMatch[1].replace(/\n/g, " ").trim() : null;

  const recIdx = text.search(/Recommendations:/i);
  const clinIdx = text.search(/Clinically Significant Variants/i);
  const recommendations =
    recIdx >= 0
      ? text
          .slice(recIdx + "Recommendations:".length, clinIdx >= 0 ? clinIdx : undefined)
          .split("•")
          .map((s) => s.replace(/\n/g, " ").trim())
          .filter(Boolean)
      : [];

  const biomarkersIdx = text.search(/Biomarkers Evaluated/i);
  const biomarkers_evaluated =
    biomarkersIdx >= 0
      ? text
          .slice(biomarkersIdx + "Biomarkers Evaluated".length)
          .split(/\n|,/)
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return { test_result, recommendations, biomarkers_evaluated };
}
