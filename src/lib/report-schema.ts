import { z } from "zod";

// Shape of the JSON Claude should extract from a GenepoweRx-style genomic
// report PDF. Derived from the schema file the user provided plus the
// `uid` field confirmed on page 1 of the sample report (a standalone
// "UID - <number>" line under Name/Age/Gender — it is NOT the same as the
// "Genomic Specimen ID" table row, which is typically blank).
export const REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    uid: {
      type: "string",
      description:
        "The report's unique identifier, found on page 1 as a standalone 'UID - <value>' line directly below the Name/Age/Gender row. Do not confuse this with 'Genomic Specimen ID' under Sample Details, which is a different (often blank) field.",
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
      items: {
        type: "object",
        properties: {
          condition: { type: "string" },
          genes_analyzed: { type: ["number", "null"] },
          risk_level: { type: ["string", "null"] },
          description: { type: "string" },
        },
        required: ["condition"],
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
        required: ["condition"],
      },
    },
    immune_health: {
      type: "object",
      properties: {
        narrative: { type: "string" },
        test_result: { type: "string" },
        variants: { type: "array", items: { type: "object" } },
        clinical_recommendations: { type: "array", items: { type: "string" } },
      },
    },
    hereditary_cancer_screening: {
      type: "object",
      properties: {
        test_result: { type: "string" },
        recommendations: { type: "array", items: { type: "string" } },
        biomarkers_evaluated: { type: "array", items: { type: "string" } },
      },
    },
    fitness_and_nutrigenomics: {
      type: "object",
      properties: {
        metabolism: {
          type: "array",
          description: "Every fitness/exercise recommendation sentence found on the fitness pages.",
          items: {
            type: "object",
            properties: { recommendation: { type: "string" } },
          },
        },
        food_sensitivity: {
          type: "array",
          description: "Every food/substance sensitivity listed (e.g. lactose, caffeine, gluten, alcohol).",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              gene: { type: "string" },
              level: { type: "string" },
            },
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
        "Every vitamin/mineral/nutrient recommendation on the vitamins & minerals pages — do not omit or summarize.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          tier: { type: ["string", "null"] },
          why: { type: "string" },
          dose: { type: "string" },
        },
        required: ["name"],
      },
    },
    methylation: {
      type: "object",
      properties: {
        markers: { type: "array", items: { type: "object" } },
        recommendations: { type: "array", items: { type: "string" } },
      },
    },
    pharmacogenomics: {
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
            "EVERY individual drug/medication card in the pharmacogenomics section — there are typically 10+ drugs, do not sample a subset.",
          items: {
            type: "object",
            properties: {
              drug: { type: "string" },
              molecule_class: { type: "string" },
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
    },
    diet_plan: { type: "array", items: { type: "object" } },
    appendix: {
      type: "object",
      properties: {
        glossary: { type: "object" },
        acmg_reference: { type: "string" },
        biomarkers_by_condition: { type: "object" },
        references: { type: "array", items: { type: "object" } },
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
