import { getDocumentProxy, getResolvedPDFJS, extractTextItems } from "unpdf";
import { reconstructLines } from "./reconstruct";
import { firstLines, findPageRun, findFirstPage } from "./structure";
import { extractUidAndAge, extractGaugeRiskLevels, extractGlossaryRiskLevels, extractFullPageText } from "./ocr-fields";
import { bodySystemFor } from "./body-system";
import {
  parsePersonalInformation,
  findGenesAnalyzed,
  findUnaddressedGlossaryConditions,
  parseMedicalConcerns,
  parseConcernsBlock,
  parseFoodSensitivityMetabolism,
  parseExercise,
  parseMusculoskeletal,
  parseVitaminsTiers,
  parseDietPlan,
  parseImmuneHealth,
  parseHereditaryCancer,
  deriveRiskFromTestResult,
  type ConditionNarrative,
} from "./sections";
import { parseDiplotypePanel, parseDrugTablePage, parseMethylationPage, parseReferencesPage, parseBiomarkersPages } from "./tables";

export class PdfExtractError extends Error {}

// Deterministic, LLM-free extraction of a GenepoweRx-style genomic report
// PDF into the JSON shape src/lib/report-mapping.ts expects. Replaces the
// OCR(whole document)+DeepSeek pipeline entirely: this document has a real
// PDF text layer for ~everything (personal info, condition narratives,
// vitamins tiers, PGx tables, etc.) except the page-1 "UID"/"Age" fields,
// which are genuinely flattened vector art and need a small targeted OCR
// crop (see ocr-fields.ts) — nothing else in the document needs OCR or
// model judgment. See the plan addendum in this session's history for the
// diagnostic work that established this.
export async function extractReportPdf(pdfBuffer: Buffer): Promise<Record<string, unknown>> {
  const data = new Uint8Array(pdfBuffer);
  const pdf = await getDocumentProxy(data);
  const pdfjs = await getResolvedPDFJS();
  const { items } = await extractTextItems(pdf);

  const linesByPage = items.map((pageItems) => reconstructLines(pageItems).filter((l) => l.trim()));
  const firsts = firstLines(linesByPage);

  // ---- Locate section page-ranges by header text, not fixed numbers ----
  const glossaryPages = findPageRun(firsts, /^CONDITIONS$/i);
  const concernsPages = findPageRun(firsts, /MEDICAL CONCERNS ANSWERED/i);
  const immunePages = findPageRun(firsts, /IMMUNE HEALTH/i);
  const cancerPage = findFirstPage(firsts, /HEREDITARY CANCER RISK/i);
  const referencesPage = findFirstPage(firsts, /^References$/i);
  const metabolismPage = findFirstPage(firsts, /YOUR METABOLISM/i);
  const foodSensitivityPage = findFirstPage(firsts, /YOUR FOOD SENSITIVITY/i);
  const fitnessPage = findFirstPage(firsts, /Tailored Fitness:/i);
  const vitaminsPage = findFirstPage(firsts, /VITAMINS AND MINERALS SUMMARY/i);
  const methylationPages = findPageRun(firsts, /METHYLATION MARKERS/i);
  const diplotypePage = findFirstPage(firsts, /PHARMACOGENOMIC ANALYSIS \(PGx\)/i);
  const drugTablePages = findPageRun(firsts, /PGx THERAPEUTIC RECOMMENDATIONS/i);
  const dietPlanPages = findPageRun(firsts, /NOURISH & THRIVE/i);
  const biomarkersPages = findPageRun(firsts, /LIST OF BIOMARKERS ANALYZED/i);

  if (linesByPage.length === 0 || firsts.every((l) => !l.trim())) {
    throw new PdfExtractError("No extractable text found in PDF — document may be a scanned image with no text layer");
  }

  // ---- Personal info + targeted OCR fallback for uid/age ----
  const personal_information = parsePersonalInformation(linesByPage[0]);
  const { uid, age } = await extractUidAndAge(pdf, items[0]);

  // ---- Immune health / hereditary cancer (parsed early so they can also
  // feed condition_risk_overview below — they're genuine risk-assessed
  // conditions in the report, just phrased as "Test Result: Positive/
  // Negative for..." rather than "You have X genetic risk for Y") ----
  const immune_health = immunePages.length ? parseImmuneHealth(immunePages.map((p) => linesByPage[p - 1])) : null;
  const hereditary_cancer_screening = cancerPage ? parseHereditaryCancer(linesByPage[cancerPage - 1]) : null;

  // ---- Condition risk overview + medical_recommendations ----
  const glossaryText = glossaryPages.map((p) => linesByPage[p - 1].join("\n")).join("\n");
  const concernsLines = concernsPages.map((p) => linesByPage[p - 1]);
  const narratives = parseMedicalConcerns(concernsLines);

  // Some concerns cards have zero extractable text at all (a broken font
  // encoding for that specific text run, not vector art — confirmed via a
  // direct text-item dump showing 0 items for the card vs dozens for a
  // normal one on the same page), so they're silently missing from the
  // text-based parse above. OCR every concerns page as a fallback and add
  // any condition it finds that the text-based parse didn't already catch.
  const narratedNames = new Set(narratives.map((n) => n.condition.trim().toLowerCase()));
  for (const p of concernsPages) {
    const ocrText = await extractFullPageText(pdf, p);
    for (const found of parseConcernsBlock(ocrText)) {
      const key = found.condition.trim().toLowerCase();
      if (!narratedNames.has(key)) {
        narratedNames.add(key);
        narratives.push(found);
      }
    }
  }

  if (fitnessPage) {
    const musculo = parseMusculoskeletal(linesByPage[fitnessPage - 1]);
    if (musculo) narratives.push(musculo);
  }
  if (immune_health?.test_result) {
    const extra: ConditionNarrative = {
      condition: "Autoimmune Conditions",
      risk_level: deriveRiskFromTestResult(immune_health.test_result),
      narrative: [immune_health.test_result, ...immune_health.variant_details].join(" "),
      recommendations: immune_health.recommendations,
    };
    narratives.push(extra);
  }
  if (hereditary_cancer_screening?.test_result) {
    const extra: ConditionNarrative = {
      condition: "Hereditary Cancer Risk",
      risk_level: deriveRiskFromTestResult(hereditary_cancer_screening.test_result),
      narrative: hereditary_cancer_screening.test_result,
      recommendations: hereditary_cancer_screening.recommendations,
    };
    narratives.push(extra);
  }

  // Conditions the glossary pages assign a risk badge to but that never get
  // a "You have X genetic risk for Y" narrative anywhere else in the report
  // (e.g. Arrhythmias, Alzheimer's Disease/Dementia, Chronic Kidney Disease)
  // — the badge is vector art with no underlying text, so it needs a
  // targeted OCR crop (see extractGlossaryRiskLevels), keyed by each row's
  // gene count since that's real, unique text per row.
  const unaddressed = findUnaddressedGlossaryConditions(narratives);
  if (unaddressed.length > 0) {
    for (const p of glossaryPages) {
      if (unaddressed.length === 0) break;
      const riskByGenes = await extractGlossaryRiskLevels(pdf, p, items[p - 1]);
      for (const name of [...unaddressed]) {
        const genes = findGenesAnalyzed(glossaryText, name);
        const riskWord = genes !== null ? riskByGenes.get(genes) : undefined;
        if (riskWord) {
          narratives.push({
            condition: name,
            risk_level: riskWord.replace(/\b\w/g, (c) => c.toUpperCase()),
            narrative: "",
            recommendations: [],
          });
          unaddressed.splice(unaddressed.indexOf(name), 1);
        }
      }
    }
  }

  const condition_risk_overview = narratives.map((n) => ({
    condition: n.condition,
    risk_level: n.risk_level,
    genes_analyzed: findGenesAnalyzed(glossaryText, n.condition),
    description: n.narrative,
    body_system: bodySystemFor(n.condition),
  }));
  const medical_recommendations = narratives.map((n) => ({
    condition: n.condition,
    risk_level: n.risk_level,
    narrative: n.narrative,
    recommendations: n.recommendations,
    body_system: bodySystemFor(n.condition),
  }));

  // ---- Food sensitivity / metabolism ----
  const foodSensitivitySourcePages = [metabolismPage, foodSensitivityPage].filter((p): p is number => p != null);
  const food_sensitivity = parseFoodSensitivityMetabolism(foodSensitivitySourcePages.map((p) => linesByPage[p - 1]));

  // Risk level for these categories is printed as a label on a thermometer
  // graphic (vector art, right-hand side of the page) rather than as
  // extractable text — confirmed via a direct text-item dump (zero items in
  // that region at all), the same category of problem as the page-1 UID
  // line. Only OCR the categories the text-based parse didn't already find
  // a risk word for, keeping OCR usage as narrow as possible.
  const categoryTitleRe = /^[A-Z][a-zA-Z ]+(?:Intolerance|Resistance)$/;
  for (const p of foodSensitivitySourcePages) {
    if (food_sensitivity.every((f) => f.risk_level !== null)) break;
    const gaugeLevels = await extractGaugeRiskLevels(pdf, p, items[p - 1], categoryTitleRe);
    for (const item of food_sensitivity) {
      if (item.risk_level === null && gaugeLevels.has(item.name)) {
        item.risk_level = gaugeLevels.get(item.name) ?? null;
      }
    }
  }

  // ---- Fitness: exercise + musculoskeletal ----
  const exercise = fitnessPage ? parseExercise(linesByPage[fitnessPage - 1]).map((r) => ({ recommendation: r })) : [];
  const musculoNarrative = fitnessPage ? parseMusculoskeletal(linesByPage[fitnessPage - 1]) : null;
  const musculoskeletal = musculoNarrative
    ? {
        profile: musculoNarrative.condition,
        risk_level: musculoNarrative.risk_level,
        narrative: musculoNarrative.narrative,
        recommendations: musculoNarrative.recommendations,
      }
    : {};

  // ---- Vitamins tiers ----
  const vitamins_and_minerals = vitaminsPage ? parseVitaminsTiers(linesByPage[vitaminsPage - 1]) : [];

  // ---- Diet plan ----
  const diet_plan_recommendations = dietPlanPages.length ? parseDietPlan(dietPlanPages.map((p) => linesByPage[p - 1])) : [];

  // ---- References / biomarkers glossary (not currently rendered by the
  // UI, but stored for completeness — see report-mapping.ts header comment
  // on which fields the app actually reads) ----
  const references = referencesPage ? await parseReferencesPage(pdfjs, await pdf.getPage(referencesPage), items[referencesPage - 1]) : [];
  const biomarkers_analyzed = biomarkersPages.length ? await parseBiomarkersPages(pdfjs, pdf, biomarkersPages, items) : [];

  // ---- Methylation markers ----
  const methylation_markers = [];
  for (const p of methylationPages) {
    const page = await pdf.getPage(p);
    methylation_markers.push(...(await parseMethylationPage(pdfjs, page, items[p - 1])));
  }

  // ---- PGx diplotype panel ----
  const diplotypes = diplotypePage ? await parseDiplotypePanel(pdfjs, pdf, diplotypePage, items[diplotypePage - 1]) : [];

  // ---- PGx drug tables ----
  const drug_recommendations = [];
  for (const p of drugTablePages) {
    const page = await pdf.getPage(p);
    drug_recommendations.push(...(await parseDrugTablePage(pdfjs, page, items[p - 1])));
  }

  return {
    uid,
    patient_information: {
      ...personal_information,
      age,
    },
    condition_risk_overview,
    medical_recommendations,
    care_plan: [],
    fitness_and_nutrigenomics: {
      exercise,
      musculoskeletal,
      food_sensitivity,
    },
    vitamins_and_minerals,
    pharmacogenomics: { diplotypes, drug_recommendations },
    // Extra sections not currently rendered by the app UI, kept for
    // completeness/future use.
    methylation_markers,
    diet_plan_recommendations,
    immune_health,
    hereditary_cancer_screening,
    references,
    biomarkers_analyzed,
  };
}
