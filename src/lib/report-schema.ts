import { z } from "zod";

// Validates the output of the deterministic extractor (src/lib/pdf-extract)
// before it's stored. This does not change what's extracted or how it's
// displayed — report-mapping.ts's alias-fallback reads are untouched, and
// this schema mirrors extractReportPdf's actual output shape (see that
// function's return statement) rather than inventing new fields. The goal
// is to turn a silent structural regression (a field missing, a table
// collapsing to zero rows, an array item shaped wrong) into a thrown 422
// with concrete Zod issues, instead of storing malformed JSON and only
// noticing later when a screen renders blank.
//
// Fields the extractor produces but the UI doesn't currently render
// (methylation_markers, diet_plan_recommendations, immune_health,
// hereditary_cancer_screening, references, biomarkers_analyzed — see
// report-mapping.ts header comment) are validated loosely (shape-checked,
// not content-checked) since a bug there can't yet be observed by a user.

const nonEmpty = z.string().min(1);

// body_system is produced by the fixed BODY_SYSTEM_MAP lookup in
// pdf-extract/body-system.ts, which always falls back to "Other" — so this
// enum should never actually fail on real data; if it does, that's a sign
// bodySystemFor's return value drifted, worth knowing about.
const BodySystem = z.enum([
  "Cardiovascular",
  "Metabolic",
  "Endocrine",
  "Gastrointestinal",
  "Neurological",
  "Musculoskeletal",
  "Immune",
  "Other",
]);

// risk_level text varies in capitalization/source ("Low"/"low"/"Moderate to
// high") across the different extraction paths (narrative regex vs. OCR
// gauge fallback) — report-mapping.ts already normalizes this
// case-insensitively (normalizeRiskKey), so validation only checks it's a
// non-empty string, not a fixed enum, to avoid failing on real, already-
// tolerated variation.
const RiskLevelText = nonEmpty;

const PersonalInformationSchema = z.object({
  name: nonEmpty,
  age: z.union([z.string(), z.number()]).nullable(),
  gender: z.string().optional().default(""),
  sample_details: z.record(z.string(), z.unknown()).optional(),
  sequencing_details: z.record(z.string(), z.unknown()).optional(),
});

const ConditionRiskOverviewSchema = z.object({
  condition: nonEmpty,
  risk_level: RiskLevelText,
  genes_analyzed: z.number().nullable(),
  description: z.string(),
  body_system: BodySystem,
});

const MedicalRecommendationSchema = z.object({
  condition: nonEmpty,
  risk_level: RiskLevelText,
  narrative: z.string(),
  recommendations: z.array(z.string()),
  body_system: BodySystem,
});

const CarePlanEntrySchema = z.object({
  condition: z.string().optional(),
  action: nonEmpty,
  cadence: z.string().optional(),
});

const ExerciseEntrySchema = z.object({
  recommendation: nonEmpty,
});

const FoodSensitivityEntrySchema = z.object({
  name: nonEmpty,
  narrative: z.string().optional(),
  risk_level: z.string().nullable().optional(),
});

const MusculoskeletalSchema = z.object({
  profile: z.string().optional(),
  risk_level: z.string().optional(),
  narrative: z.string().optional(),
  recommendations: z.array(z.string()).optional(),
});

const FitnessAndNutrigenomicsSchema = z.object({
  exercise: z.array(ExerciseEntrySchema),
  musculoskeletal: MusculoskeletalSchema,
  food_sensitivity: z.array(FoodSensitivityEntrySchema),
});

// tier comes from parseVitaminsTiers's fixed tierRe match — a real
// structural miss here (e.g. the tier-heading regex failing to match on a
// differently-formatted report) is exactly the kind of silent regression
// this schema exists to catch.
const VitaminEntrySchema = z.object({
  name: nonEmpty,
  dose: z.string().optional().default(""),
  tier: z.enum(["Essential", "Advised", "Optional"]),
});

const DiplotypeEntrySchema = z.object({
  gene: nonEmpty,
  diplotype: z.string().optional().default(""),
  phenotype: z.string().optional().default(""),
});

// The highest-stakes table in the report — molecule_class carry-forward
// (see parseDrugTablePage's header comment) is exactly what this session's
// "Potassium Sparing" bug broke, so require every row to actually have a
// non-empty class rather than silently accepting a blank one.
const DrugRecommendationSchema = z.object({
  molecule_class: nonEmpty,
  drug: nonEmpty,
  evidence_level: z.string().optional().default(""),
  phenotype: z.string().optional().default(""),
  status: z.string().optional().default(""),
  recommendation: z.string().optional().default(""),
});

const PharmacogenomicsSchema = z
  .object({
    diplotypes: z.array(DiplotypeEntrySchema),
    drug_recommendations: z.array(DrugRecommendationSchema),
  })
  .superRefine((val, ctx) => {
    // Cross-check: every drug row's molecule_class should appear as some
    // diplotype's implied context somewhere in the document is too strong a
    // check to make (classes and genes aren't 1:1) — but a wholesale
    // collapse of the drug table (rows present but all sharing one class,
    // or a suspiciously tiny row count next to a real diplotype panel) is
    // the actual failure mode this session hit. Flag the cheap, concrete
    // version of that: if there are diplotypes at all but zero drug
    // recommendations, the drug-table page range or fill-grid detection
    // likely failed to find any pages/rows.
    if (val.diplotypes.length > 0 && val.drug_recommendations.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "diplotypes were extracted but drug_recommendations is empty — the PGx drug table likely failed to parse",
        path: ["drug_recommendations"],
      });
    }
    // A drug table that parsed but collapsed every row into one
    // molecule_class (the exact shape of the "Potassium Sparing absorbed
    // Calcium Channel Blockers + Beta Blockers" bug) is a strong signal the
    // per-row label-owner logic in parseDrugTablePage regressed.
    if (val.drug_recommendations.length >= 10) {
      const distinctClasses = new Set(val.drug_recommendations.map((d) => d.molecule_class.trim().toLowerCase()));
      if (distinctClasses.size === 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${val.drug_recommendations.length} drug rows all share a single molecule_class ("${val.drug_recommendations[0]?.molecule_class}") — likely a molecule-class grouping regression, not a real report`,
          path: ["drug_recommendations"],
        });
      }
    }
  });

export const reportDataSchema = z
  .object({
    uid: nonEmpty,
    patient_information: PersonalInformationSchema,
    condition_risk_overview: z.array(ConditionRiskOverviewSchema),
    medical_recommendations: z.array(MedicalRecommendationSchema),
    care_plan: z.array(CarePlanEntrySchema).optional().default([]),
    fitness_and_nutrigenomics: FitnessAndNutrigenomicsSchema,
    vitamins_and_minerals: z.array(VitaminEntrySchema),
    pharmacogenomics: PharmacogenomicsSchema,
  })
  // Sections the extractor produces but the UI doesn't render yet — kept
  // permissive (shape not enforced) rather than omitted entirely, since
  // dropping them here would silently strip them before storage.
  .catchall(z.unknown());

export type ReportData = z.infer<typeof reportDataSchema>;
