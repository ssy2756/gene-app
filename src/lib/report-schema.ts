import { z } from "zod";

// Shape of the JSON to extract from a GenepoweRx-style genomic report PDF,
// exactly as given by the user (plus a top-level "uid" field, since the
// app needs a lookup key — derived from the standalone "UID - <value>"
// line on page 1, distinct from the "Genomic Specimen ID" table row).
export const REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    uid: {
      type: "string",
      description:
        "The report's unique identifier, found on page 1 as a standalone 'UID - <value>' line directly below the Name/Age/Gender row.",
    },
    patient_information: {
      type: "object",
      properties: {
        name: { type: "string" },
        sample_details: { type: "object" },
        sequencing_details: { type: "object" },
      },
      required: ["name"],
    },
    condition_risk_overview: {
      type: "array",
      items: {
        type: "object",
        properties: {
          condition: { type: "string" },
          genes_analyzed: { type: ["number", "null"] },
          risk_level: { type: ["string", "null"] },
          description: { type: "string" },
        },
      },
    },
    medical_recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          condition: { type: "string" },
          risk_level: { type: ["string", "null"] },
          narrative: { type: "string" },
          recommendations: { type: "array", items: { type: "string" } },
        },
      },
    },
    immune_health: {
      type: "object",
      properties: {
        narrative: { type: "string" },
        test_result: { type: "string" },
        variants: { type: "array" },
        clinical_recommendations: { type: "array" },
      },
    },
    hereditary_cancer_screening: {
      type: "object",
      properties: {
        test_result: { type: "string" },
        recommendations: { type: "array" },
        biomarkers_evaluated: { type: "array", items: { type: "string" } },
      },
    },
    fitness_and_nutrigenomics: {
      type: "object",
      properties: {
        metabolism: { type: "array" },
        food_sensitivity: { type: "array" },
        musculoskeletal: { type: "object" },
      },
    },
    vitamins_and_minerals: { type: "object" },
    methylation: {
      type: "object",
      properties: {
        markers: { type: "array" },
        recommendations: { type: "array" },
      },
    },
    pharmacogenomics: {
      type: "object",
      properties: {
        diplotypes: { type: "array" },
        drug_recommendations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              molecule_class: { type: "string" },
              drug: { type: "string" },
            },
          },
        },
        summary: { type: "object" },
      },
    },
    diet_plan: { type: "array" },
    appendix: {
      type: "object",
      properties: {
        glossary: { type: "object" },
        acmg_reference: { type: "string" },
        biomarkers_by_condition: { type: "object" },
        references: { type: "array" },
      },
    },
  },
  required: ["uid", "patient_information"],
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
