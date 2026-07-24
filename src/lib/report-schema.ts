import { z } from "zod";

// Extraction is split into two separate LLM calls (see ingest-report.ts):
// GENE_REPORT_SCHEMA for everything except pharmacogenomics, and
// PHARMACOGENOMICS_SCHEMA on its own — the pharmacogenomics section alone
// commonly spans 300+ individual drug rows across dozens of drug classes,
// which risks truncation/under-extraction if crammed into the same
// response as everything else.
export const GENE_REPORT_SCHEMA = {
  type: "object",
  properties: {
    uid: {
      type: "string",
      description:
        "The report's unique identifier: the value on the literal 'UID - <value>' line on page 1, directly under Name/Age/Gender. This is NOT the same field as sample_details.genomic_specimen_id (that field is usually blank on these reports) — do not use it as the uid. If the UID line is genuinely illegible or absent, use the patient name alone instead — never invent a placeholder value.",
    },
    patient_information: {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: ["string", "number", "null"] },
        gender: { type: "string" },
        sample_details: {
          type: "object",
          properties: {
            collection_date: { type: ["string", "null"] },
            type_of_sample: { type: "string" },
            genomic_specimen_id: { type: ["string", "null"] },
          },
        },
        sequencing_details: {
          type: "object",
          properties: {
            sequencing_type: { type: "string" },
            method: { type: "string" },
            mean_sequencing_depth: { type: ["string", "number", "null"] },
            encoding: { type: "string" },
            sequence_length: { type: "string" },
            overall_alignment_rate: { type: ["string", "number", "null"] },
            q30_score: { type: ["string", "number", "null"] },
          },
        },
      },
      required: ["name"],
    },
    condition_risk_overview: {
      type: "array",
      description: "One entry per condition covered by the report — every condition analyzed must appear here.",
      items: {
        type: "object",
        properties: {
          condition: { type: "string" },
          genes_analyzed: { type: ["number", "null"] },
          risk_level: { type: ["string", "null"] },
          description: { type: "string" },
          body_system: {
            type: "string",
            enum: [
              "Cardiovascular",
              "Endocrine",
              "Neurological",
              "Metabolic",
              "Gastrointestinal",
              "Ophthalmic",
              "Musculoskeletal",
              "Immune",
              "Other",
            ],
            description:
              "The report does not print a body system per condition — classify it yourself using standard medical knowledge, choosing the single best-fitting value from the enum list.",
          },
        },
        required: ["condition", "body_system"],
      },
    },
    medical_recommendations: {
      type: "array",
      description: "One entry per condition, matching condition_risk_overview by the same condition name.",
      items: {
        type: "object",
        properties: {
          condition: { type: "string" },
          risk_level: { type: ["string", "null"] },
          narrative: { type: "string" },
          recommendations: { type: "array", items: { type: "string" } },
          body_system: {
            type: "string",
            description: "The exact same body_system value you gave this same condition in condition_risk_overview — must match, not be re-derived independently.",
          },
        },
        required: ["condition", "body_system"],
      },
    },
    care_plan: {
      type: "array",
      description:
        "care_plan is NOT a section printed in the report — synthesize it yourself from the 'monitor X every Y' style monitoring/follow-up actions already present in medical_recommendations (and elsewhere in the extracted data). Deduplicate repeated actions that appear across multiple conditions (e.g. the same lab test recommended for two different conditions should appear once, not twice). This field must be populated whenever medical_recommendations contains any monitoring-style action — do not leave it empty if such actions exist.",
      items: {
        type: "object",
        properties: {
          condition: { type: "string" },
          action: { type: "string" },
          cadence: { type: "string" },
        },
        required: ["action"],
      },
    },
    fitness_and_nutrigenomics: {
      type: "object",
      properties: {
        exercise: {
          type: "array",
          description:
            "Every bullet point, verbatim, from ONLY the 'Exercise' subsection of the 'Tailored Fitness: Musculoskeletal Resilience for Every Step' page. Do NOT pull content from 'Medical Recommendations', 'Diet and Nutrition', or the separate 'Your Metabolism' section — those are different sections and do not belong here. Transcribe exactly as printed, not summarized, reworded, or interpreted. The field name is 'exercise' — do not emit the old name 'metabolism' instead.",
          items: {
            type: "object",
            properties: { recommendation: { type: "string" } },
            required: ["recommendation"],
          },
        },
        food_sensitivity: {
          type: "array",
          description:
            "Every food/substance sensitivity listed (e.g. lactose, caffeine, gluten, insulin resistance). Source: the document's 'Your Metabolism' section specifically (this is a different section from the Exercise subsection above — do not confuse the two). This section reliably exists in these reports — this field must always be populated, never left empty, when it does.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              gene: { type: "string" },
              level: { type: "string" },
            },
            required: ["name"],
          },
        },
        musculoskeletal: {
          type: "object",
          properties: {
            profile: { type: "string" },
            detail: { type: "string" },
          },
        },
      },
    },
    vitamins_and_minerals: {
      type: "array",
      description:
        "Every INDIVIDUAL vitamin/mineral/nutrient recommendation on the 'Vitamins and Minerals Summary' page, as a flat line-item list — NOT a paragraph summary, and NOT grouped by tier into nested objects. Each item's 'tier' must be the literal section label printed above/around it on the page (typically 'Essential', 'Advised', or 'Optional'), verified visually against the actual page layout — do not infer tier from list position or from what seems typical; some tiers may have zero items and that is expected, do not invent items to fill an empty tier.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          tier: { type: "string", description: "The literal tier label printed on the page for this specific item, e.g. 'Essential', 'Advised', or 'Optional'." },
          why: { type: "string" },
          dose: { type: "string" },
        },
        required: ["name", "tier"],
      },
    },
  },
  required: ["uid", "patient_information"],
  additionalProperties: false,
} as const;

// Extracted in its own call — see GENE_REPORT_SCHEMA's header comment for
// why. This section alone commonly has 300+ individual drug rows across
// dozens of drug classes (antiplatelets, anticoagulants, antihypertensives,
// diabetic drugs, statins, PPIs, antiemetics, painkillers, asthma meds,
// anti-inflammatories, anti-epileptics, opioids, psychiatric drugs,
// antivirals, transplant drugs, etc.) — a gene diplotype panel, then
// per-drug-class tables of individual drug rows, then a therapeutic
// summary.
export const PHARMACOGENOMICS_SCHEMA = {
  type: "object",
  properties: {
    diplotypes: {
      type: "array",
      description: "Every gene tested in the diplotype panel — do not omit any.",
      items: {
        type: "object",
        properties: {
          gene: { type: "string" },
          diplotype: { type: "string" },
          phenotype: { type: "string" },
        },
      },
    },
    drug_recommendations: {
      type: "array",
      description:
        "EVERY individual drug row across every drug class in the pharmacogenomics section — typically 300+ rows across dozens of classes. Do not summarize, sample, or truncate the list; go through the section class by class and row by row.",
      items: {
        type: "object",
        properties: {
          molecule_class: { type: "string" },
          drug: { type: "string" },
          gene: { type: "string" },
          diplotype: { type: "string" },
          phenotype: { type: "string" },
          status: {
            type: "string",
            description: "e.g. 'Use as Directed', 'Use with Caution', 'Adjust Dose', 'Not Enough Evidence'",
          },
          evidence_level: { type: "string" },
          recommendation: { type: "string" },
        },
        required: ["drug"],
      },
    },
    summary: { type: "object" },
  },
  additionalProperties: true,
} as const;

// Loose validator: enforces the fields we depend on (uid, patient_information)
// while staying permissive on the deeply nested report sections, whose exact
// shape varies by report type/section and isn't worth hard-failing on.
export const reportDataSchema = z
  .object({
    uid: z.string().min(1, "Missing uid"),
    patient_information: z.record(z.string(), z.unknown()),
  })
  .catchall(z.unknown());

export type ReportData = z.infer<typeof reportDataSchema>;
