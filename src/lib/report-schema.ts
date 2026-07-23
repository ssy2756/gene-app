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
        "The report's unique identifier: the Genomic Specimen ID printed on the report. If it is blank, use the patient name alone instead — never invent a placeholder value.",
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
          body_system: {
            type: "string",
            description:
              "The report does not print a body system per condition — classify it yourself using standard medical knowledge (e.g. Cardiovascular, Endocrine, Neurological, Ophthalmic, Metabolic, Gastrointestinal, etc.).",
          },
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
          body_system: {
            type: "string",
            description: "Same body-system classification as condition_risk_overview for this same condition — keep it consistent across both.",
          },
        },
        required: ["condition"],
      },
    },
    care_plan: {
      type: "array",
      description:
        "care_plan is NOT a section printed in the report — synthesize it yourself from the 'monitor X every Y' style monitoring/follow-up actions already present in medical_recommendations (and elsewhere in the extracted data). Deduplicate repeated actions that appear across multiple conditions (e.g. the same lab test recommended for two different conditions should appear once, not twice).",
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
        exercise: {
          type: "array",
          description:
            "Every bullet point, verbatim, from the 'Exercise' subsection of the 'Tailored Fitness: Musculoskeletal Resilience for Every Step' page — transcribed exactly as printed, not summarized, reworded, or interpreted.",
          items: {
            type: "object",
            properties: { recommendation: { type: "string" } },
          },
        },
        food_sensitivity: {
          type: "array",
          description:
            "Every food/substance sensitivity listed (e.g. lactose, caffeine, gluten, insulin resistance). Source: the document's 'Your Metabolism' (or similarly named) section. This section reliably exists in these reports — this field must always be populated, never left empty, when it does.",
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
      type: "object",
      description:
        "Every INDIVIDUAL vitamin/mineral/nutrient recommendation on the vitamins & minerals pages, as a line-item list — NOT a paragraph summary. A single 'summary' string is not an acceptable substitute even if the page also contains introductory prose; extract the itemized data underneath it. Either shape is acceptable: a flat array of {name, tier, why, dose} objects (property name e.g. \"items\"), or an object keyed by tier whose values are arrays of {name, why, dose} objects — use whichever shape matches how the document itself groups them. Tier names (if any) must be the literal label printed on the page for each item, verified visually — do not assume a fixed 'Essential/Advised/Optional' scheme; many documents use different tier names or no tiers at all. Every named vitamin/mineral/nutrient on the page MUST appear as its own object with at least a name and dose.",
    },
    methylation: {
      type: "object",
      properties: {
        markers: { type: "array", items: { type: "object" } },
        recommendations: { type: "array", items: { type: "string" } },
      },
    },
    diet_plan: { type: "array", items: { type: "object" } },
    appendix: {
      type: "object",
      properties: {
        glossary: { type: "object" },
        acmg_reference: {
          type: "string",
          description: "Static boilerplate reference text (e.g. ACMG classification note) — copy verbatim if present, do not summarize.",
        },
        biomarkers_by_condition: { type: "object" },
        references: { type: "array", items: { type: "object" } },
      },
    },
  },
  required: ["uid", "patient_information"],
  additionalProperties: true,
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
