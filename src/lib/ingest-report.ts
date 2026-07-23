import OpenAI from "openai";
import { sql } from "@/lib/db";
import { GENE_REPORT_SCHEMA, PHARMACOGENOMICS_SCHEMA, reportDataSchema } from "@/lib/report-schema";

// Lazily constructed on first use, not at module load: the OpenAI SDK throws
// immediately if no API key is available, and Next.js evaluates route
// modules during its build-time "collect page data" step even for dynamic
// routes — throwing at import time would fail the build itself whenever
// OPENAI_API_KEY isn't set yet (e.g. before it's added in Vercel).
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

// Vision-capable, PDF-file-input-capable model. Override via env if a newer
// model should be used without a code change.
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

export class IngestError extends Error {
  status: number;
  issues?: unknown;

  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

// Shared vision-inspection preamble for both calls.
const VISION_PREAMBLE = `This is a multi-page genomic report PDF (commonly 60-90+ pages). Visually inspect EVERY SINGLE PAGE, from the first page to the last, as an image — do not rely on any embedded/extracted text layer alone, since some fields (including colored risk badges and the UID) are rendered graphically and have no text-layer equivalent, and do not stop scanning after the first few pages. Treat this as a careful transcription task, not a summarization task: do not paraphrase, estimate, or recall a "typical" report from memory — only report what is actually visible on the page in front of you.`;

// The main-report prompt: user-provided base instructions, plus every
// hard-won accuracy fix from real-report testing (risk levels, vitamins
// tiering/layout, exercise-section scoping, food_sensitivity source).
const GENE_REPORT_PROMPT = `${VISION_PREAMBLE}

Extract all data from this GenepoweRx genetic report PDF into JSON, following the field names in the schema below exactly (snake_case). Do NOT include the pharmacogenomics section — that is extracted separately. The uid is the Genomic Specimen ID printed on the report; if it is blank, use the patient name alone (do not invent a placeholder for a missing collection date). Preserve every condition, risk level, gene, and recommendation you find — do not summarize or drop rows. Do not fabricate the appendix/glossary reference tables — omit them if not asked. The report does not print a body system per condition, so classify each condition's body_system yourself using standard medical knowledge. care_plan is not a section of the report — synthesize it from the "monitor X every Y" style actions already present in medical_recommendations and elsewhere, deduplicating repeated actions across conditions.

CRITICAL ACCURACY RULES — read these before extracting anything:

1. RISK LEVELS MUST MATCH THE DOCUMENT EXACTLY. Each condition's risk level (Low / Mild / Moderate / Moderate to high / High) is shown as a specific colored pill or bar segment on the "RISK GLOSSARY OF MEDICAL CONDITIONS" pages and/or on that condition's own detail page. For every single condition, look directly at its risk indicator on the page — do not infer risk from the condition's name, from what's "usually" true for that condition, or from a similar-sounding condition elsewhere in the document. If you are not certain which color/label applies to a specific condition, re-examine that exact page region before answering. Getting a risk level wrong (e.g. reporting "Mild" when the page clearly shows "Low") is a critical error.

2. EXTRACT EVERY CONDITION AND RECOMMENDATION, NOT A SAMPLE. Go through every page of condition_risk_overview (every condition in the glossary) and medical_recommendations (every condition with a dedicated recommendations page) — do not stop after the first few or pick only "representative" examples.

3. LIFESTYLE SECTIONS ARE OFTEN UNDER-EXTRACTED — BE THOROUGH, AND NEVER SUBSTITUTE A SUMMARY FOR THE ITEMIZED LIST. "vitamins_and_minerals" and "fitness_and_nutrigenomics" each have dedicated pages with specific, itemized, extractable content — they are not optional or summary sections.

The document has a page titled (or similarly titled) "Vitamins and Minerals Summary" — despite the word "Summary" in its title, this page is NOT a prose overview to condense into one sentence. It contains an itemized breakdown of individual vitamins/minerals/nutrients, with each item showing its name and a specific dose/amount. You MUST scrape every individual vitamin/mineral/nutrient row from this page into "vitamins_and_minerals" as structured data — a single {"summary": "..."} string field describing the page in general terms is NEVER an acceptable output, even if the page also has introductory prose above the itemized rows.

CRITICAL — DO NOT ASSUME OR INVENT TIER NAMES. Vision-inspect each item's own row/badge/section header on the page and use ONLY the literal tier label actually printed there for that specific item. "Essential", "Advised", and "Optional" are common tier names in reports like this, but they are NOT guaranteed to be the tiers used in every document, and not every report tiers its vitamins at all. Do not default to a 3-tier scheme out of habit; if the page shows different tier names (or none), use exactly what is shown, or omit "tier" entirely if the page doesn't group items into tiers.

For vitamins_and_minerals, produce an array of objects (or an object keyed by tier if the document itself visibly groups them into tiers), each item with: "name" (the exact vitamin/mineral/nutrient name), "tier" (the exact tier label printed on the page for this specific item, verified by looking directly at it — omit this field if the page shows no tier for it), "why" (the short genetic reason shown next to it, if any), and "dose" (the exact recommended dose/amount shown). Extract every single item shown across every tier (or across the flat list, if untiered) — do not stop after the first tier/section or sample a subset.

If — and only if — the document's own tiers are named "Essential", "Advised", and "Optional" (verified per-item as above, not assumed), emit them in that order (Essential, then Advised, then Optional).

A TIER SECTION HEADER CAN BE PRESENT ON THE PAGE WITH ZERO ITEMS LISTED UNDER IT — this is common and completely valid; it is NOT a signal to invent items for that tier or to move items from a different tier into it. Do NOT redistribute items to make every tier look populated, and do NOT assign an item to "Essential" just because that header exists on the page — every item's tier assignment must come from which section it is physically printed under, nothing else.

EXACT LAYOUT PATTERN: this page commonly shows a human body silhouette down the left side, with colored horizontal connector lines running out to each tier label (top to bottom). The vitamin/mineral names and doses for a given tier are listed in a vertical column positioned BELOW that tier's own connector line/label and ABOVE the next tier's connector line/label. Trace each item's vertical position on the page to the nearest tier label ABOVE it — do not assign tiers by list order/position-in-your-output (e.g. "first N items = Essential"); assign strictly by the item's own physical position on the page relative to the connector lines.

"food_sensitivity" MUST ALWAYS BE POPULATED — it is not optional. Its source is the document's "Your Metabolism" section (or similarly named nutrigenomics/intolerance section), which typically lists several named sensitivities/intolerances such as "Lactose Intolerance", "Gluten Intolerance", "Insulin Resistance", "Caffeine sensitivity", etc. — this section reliably exists in these reports and MUST be scraped into "food_sensitivity", one object per sensitivity/intolerance listed. Do not leave "food_sensitivity" empty if this section exists in the document.

The document has a page titled (or similarly titled) "Tailored Fitness: Musculoskeletal Resilience for Every Step" containing multiple subsections, commonly including "Medical Recommendations", "Diet and Nutrition", and "Exercise". The field "exercise" must be scraped ONLY from the "Exercise" subsection of this page — not from "Medical Recommendations" (that belongs in medical_recommendations instead), not from "Diet and Nutrition" (that belongs in diet_plan instead), and not from the separate "Your Metabolism" section (that data belongs nowhere in this schema except its sensitivity list, which goes in "food_sensitivity" as described above).

For "exercise", TRANSCRIBE — DO NOT INTERPRET, SUMMARIZE, PARAPHRASE, OR MERGE. Produce one array item per bullet point exactly as it appears in the Exercise subsection (e.g. separate bullets like "Frequency - 4 days per week.", "Intensity - Moderate.", "Time - 30 minutes.", "Type - ...", "Precautions - ..." each become their own array item, with the same wording — not rewritten into a single combined sentence). A bullet about nutrients, deficiencies, diet, or medications (e.g. "Monitor for micronutrients and other nutritional deficiencies...") is Medical Recommendations content, NOT Exercise content, and must not appear in "exercise" even if it sits near the Exercise subsection on the page.

Extract the data as JSON matching this schema:

${JSON.stringify(GENE_REPORT_SCHEMA, null, 2)}

Respond with ONLY the JSON object, no other text.`;

// The pharmacogenomics prompt: extracted in its own call so its (often
// 300+ row) drug table gets a dedicated output-token budget instead of
// competing with everything else in the main report for the same 16k cap.
const PHARMACOGENOMICS_PROMPT = `${VISION_PREAMBLE}

This report has a large Pharmacogenomics (PGx) section spanning many pages: a gene diplotype panel, then per-drug-class tables of individual drug rows (molecule class, drug name, level of evidence, response category/mechanism, clinical recommendation), then a therapeutic summary. Extract every single diplotype row and every single drug row into JSON — there are typically 300+ drug rows across dozens of drug classes (antiplatelets, anticoagulants, antihypertensives, diabetic drugs, statins, PPIs, antiemetics, painkillers, asthma meds, anti-inflammatories, anti-epileptics, opioids, psychiatric drugs, antivirals, transplant drugs, etc.). Do not summarize, sample, or truncate the list — go through the PGx section class by class and row by row.

Extract the data as JSON matching this schema:

${JSON.stringify(PHARMACOGENOMICS_SCHEMA, null, 2)}

Respond with ONLY the JSON object, no other text.`;

function parseJsonResponse(text: string | null | undefined): unknown {
  if (!text) {
    throw new IngestError("No text response from model", 502);
  }
  try {
    return JSON.parse(text);
  } catch {
    // Defense in depth on top of the json_object response format below:
    // strip markdown code fences some models still add, and fall back to
    // the largest {...} substring if there's stray prose around the JSON.
    const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
      return JSON.parse(stripped);
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new IngestError("Model did not return valid JSON", 502);
      }
      try {
        return JSON.parse(match[0]);
      } catch {
        throw new IngestError("Model did not return valid JSON", 502);
      }
    }
  }
}

// Runs one PDF-vision extraction call with the given prompt and returns the
// parsed JSON object.
async function extract(pdfBase64: string, prompt: string): Promise<Record<string, unknown>> {
  // IMPORTANT: these reports render some fields (e.g. the UID) as
  // graphics/vector art with no corresponding text-layer content — a
  // text-extraction pass over the PDF misses them entirely. Passing the
  // PDF as an `input_file` makes the model read it via vision (each page
  // rendered as an image internally), not just its text layer. Do not
  // swap this for a text-only extraction path.
  const response = await getOpenAI().responses.create({
    model: MODEL,
    // gpt-4o's output cap is 16384 tokens; raise this if OPENAI_MODEL is
    // swapped for a model with a larger output limit.
    max_output_tokens: 16000,
    // Forces valid JSON output. Without this, smaller models sometimes
    // wrap the JSON in markdown code fences or add stray prose despite
    // the prompt saying not to — this makes it a hard API-level guarantee
    // instead of a request.
    text: { format: { type: "json_object" } },
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: "report.pdf",
            file_data: `data:application/pdf;base64,${pdfBase64}`,
          },
          { type: "input_text", text: prompt },
        ],
      },
    ],
  });

  const parsed = parseJsonResponse(response.output_text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new IngestError("Model did not return a JSON object", 502);
  }
  return parsed as Record<string, unknown>;
}

// Parses a genomic report PDF via two OpenAI calls (main report, then
// pharmacogenomics separately), merges and validates the result, and
// upserts it into `reports` keyed by uid. Shared by the manual upload
// route (src/app/api/parse-pdf/route.ts) and the Google Drive ingestion
// pipeline (src/app/api/drive/webhook, scripts/poll-drive.ts) so there is
// exactly one place that defines how a PDF becomes a stored report.
export async function ingestReportPdf(pdfBuffer: Buffer): Promise<{ uid: string }> {
  const pdfBase64 = pdfBuffer.toString("base64");

  const [mainData, pharmacogenomics] = await Promise.all([
    extract(pdfBase64, GENE_REPORT_PROMPT),
    extract(pdfBase64, PHARMACOGENOMICS_PROMPT),
  ]);

  const merged = { ...mainData, pharmacogenomics };

  const validation = reportDataSchema.safeParse(merged);
  if (!validation.success) {
    throw new IngestError("Parsed JSON failed validation", 422, validation.error.issues);
  }

  const { uid, ...data } = validation.data;

  await sql`
    INSERT INTO reports (uid, data, updated_at)
    VALUES (${uid}, ${JSON.stringify(data)}::jsonb, now())
    ON CONFLICT (uid) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;

  return { uid };
}
