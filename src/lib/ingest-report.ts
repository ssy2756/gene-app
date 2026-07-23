import OpenAI from "openai";
import { sql } from "@/lib/db";
import { REPORT_JSON_SCHEMA, reportDataSchema } from "@/lib/report-schema";

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

// Parses a genomic report PDF via OpenAI, validates the result, and upserts
// it into `reports` keyed by uid. Shared by the manual upload route
// (src/app/api/parse-pdf/route.ts) and the Google Drive ingestion pipeline
// (src/app/api/drive/webhook, scripts/poll-drive.ts) so there is exactly one
// place that defines how a PDF becomes a stored report.
export async function ingestReportPdf(pdfBuffer: Buffer): Promise<{ uid: string }> {
  const pdfBase64 = pdfBuffer.toString("base64");

  // IMPORTANT: these reports render some fields (e.g. the UID) as graphics/vector
  // art with no corresponding text-layer content — a text-extraction pass over
  // the PDF misses them entirely. Passing the PDF as an `input_file` makes the
  // model read it via vision (each page rendered as an image internally), not
  // just its text layer; the prompt below reinforces that explicitly. Do not
  // swap this for a text-only extraction path (e.g. pdf-parse/pdfplumber piped
  // into a plain text prompt).
  const response = await getOpenAI().responses.create({
    model: MODEL,
    // gpt-4o's output cap is 16384 tokens; raise this if OPENAI_MODEL is
    // swapped for a model with a larger output limit.
    max_output_tokens: 16000,
    // Forces valid JSON output. Without this, smaller models (e.g.
    // gpt-4o-mini) sometimes wrap the JSON in markdown code fences or add
    // stray prose despite the prompt saying not to — this makes it a hard
    // API-level guarantee instead of a request.
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
          {
            type: "input_text",
            text: `This is a multi-page genomic report PDF (commonly 60-90+ pages). Visually inspect EVERY SINGLE PAGE, from the first page to the last, as an image — do not rely on any embedded/extracted text layer alone, since some fields (including colored risk badges and the UID) are rendered graphically and have no text-layer equivalent, and do not stop scanning after the first few pages. Every section of the schema below lives on its own pages later in the document — go through the entire PDF page by page and populate each section from the pages where it actually appears, not just from page 1. Treat this as a careful transcription task, not a summarization task: do not paraphrase, estimate, or recall a "typical" report from memory — only report what is actually visible on the page in front of you.

CRITICAL ACCURACY RULES — read these before extracting anything:

1. RISK LEVELS MUST MATCH THE DOCUMENT EXACTLY. Each condition's risk level (Low / Mild / Moderate / Moderate to high / High) is shown as a specific colored pill or bar segment on the "RISK GLOSSARY OF MEDICAL CONDITIONS" pages and/or on that condition's own detail page. For every single condition, look directly at its risk indicator on the page — do not infer risk from the condition's name, from what's "usually" true for that condition, or from a similar-sounding condition elsewhere in the document. If you are not certain which color/label applies to a specific condition, re-examine that exact page region before answering. Getting a risk level wrong (e.g. reporting "Mild" when the page clearly shows "Low") is a critical error.

2. EXTRACT EVERY MEDICATION, NOT A SAMPLE. The pharmacogenomics section lists many individual drug/medication cards, each with its own gene, diplotype, phenotype, and recommendation. Go through every page of this section and include EVERY drug mentioned — do not stop after the first few or pick only "representative" examples. The same applies to condition_risk_overview (every condition in the glossary) and medical_recommendations (every condition with a dedicated recommendations page).

3. LIFESTYLE SECTIONS ARE OFTEN UNDER-EXTRACTED — BE THOROUGH, AND NEVER SUBSTITUTE A SUMMARY FOR THE ITEMIZED LIST. "vitamins_and_minerals" and "fitness_and_nutrigenomics" each have dedicated pages with specific, itemized, extractable content — they are not optional or summary sections.

The document has a page titled (or similarly titled) "Vitamins and Minerals Summary" — despite the word "Summary" in its title, this page is NOT a prose overview to condense into one sentence. It contains a itemized breakdown of individual vitamins/minerals/nutrients, usually grouped into tiers (e.g. Essential / Advised / Optional, shown as colored badges or headers), with each item showing its name, the genetic reason it's recommended, and a specific dose/amount. You MUST scrape every individual vitamin/mineral/nutrient row from this page into "vitamins_and_minerals" as structured data — a single {"summary": "..."} string field describing the page in general terms is NEVER an acceptable output, even if the page also has introductory prose above the itemized rows.

For vitamins_and_minerals, produce an array of objects (or an object keyed by tier if the document groups them into tiers), each item with: "name" (the exact vitamin/mineral/nutrient name, e.g. "Vitamin D3", "Folate (5-MTHF)"), "tier" (the tier badge/header it appears under, if any), "why" (the short genetic reason shown next to it, e.g. "VDR variant · lower baseline"), and "dose" (the exact recommended dose/amount shown, e.g. "2000 IU"). Extract every single item shown across every tier — do not stop after the first tier or sample a subset.

For fitness_and_nutrigenomics: "food_sensitivity" as an array of objects, one per food/substance sensitivity, each with whatever fields the page actually shows (a name/type, the genetic basis, and the sensitivity level/recommendations) — do not omit any individual sensitivity shown. "musculoskeletal" as an object with the fitness/muscle-type profile info actually shown (narrative, risk/level, recommendations).

IMPORTANT — do not let the schema field name "metabolism" fool you into pulling data from the document's own "Your Metabolism" section (a DIFFERENT section, e.g. covering things like "Carbohydrate Intolerance", "Lactose Intolerance", metabolic-pathway/enzyme content). That "Your Metabolism" section is the WRONG source for this field, even though its title superficially matches the field name — do not extract anything from it into "metabolism".

The document has a page titled (or similarly titled) "Tailored Fitness: Musculoskeletal Resilience for Every Step". This page contains MULTIPLE subsections, commonly including "Medical Recommendations", "Diet and Nutrition", and "Exercise" — the schema field "metabolism" must be scraped ONLY from the "Exercise" subsection of THIS "Tailored Fitness" page (not from "Your Metabolism", not from "Medical Recommendations", not from "Diet and Nutrition"). "metabolism" holds the fitness/exercise recommendations shown in the app's "Fitness & exercise" list — despite its name, it is exercise data, not metabolic-pathway data and not food-intolerance data. Do NOT pull content from the "Medical Recommendations" subsection (that belongs in medical_recommendations/condition_risk_overview instead), the "Diet and Nutrition" subsection (that belongs in diet_plan instead), or the separate "Your Metabolism" section (that data has no home in this schema and should simply be left out) into "metabolism" — including any of that content here is a mistake, even if it appears on the same page or under a similarly-named heading. Scrape every individual recommendation/area shown under the "Tailored Fitness" page's Exercise subsection specifically into "metabolism" as an array of objects, one per recommendation area, each with its own recommendation text (and a "type" label if the subsection groups them into named areas). Do not summarize the Exercise subsection into one or two generic bullets — extract every distinct recommendation it lists, but nothing from any other section or subsection.

If any of these pages exist in the document, this itemized data MUST be present in your output — an empty array or missing field here is only acceptable if that section is genuinely absent from the PDF.

Extract the data as JSON matching this schema:\n\n${JSON.stringify(
              REPORT_JSON_SCHEMA,
              null,
              2
            )}\n\nThe "uid" field is a standalone "UID - <value>" line on page 1, directly below the Name/Age/Gender row, visible only in the rendered page image. It is a different field from "Genomic Specimen ID" under Sample Details (which is often blank) — do not confuse them.\n\nRespond with ONLY the JSON object, no other text.`,
          },
        ],
      },
    ],
  });

  const text = response.output_text;
  if (!text) {
    throw new IngestError("No text response from model", 502);
  }

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(text);
  } catch {
    // Defense in depth on top of the json_object response format above:
    // strip markdown code fences some models still add, and fall back to
    // the largest {...} substring if there's stray prose around the JSON.
    const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
      rawParsed = JSON.parse(stripped);
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new IngestError("Model did not return valid JSON", 502);
      }
      try {
        rawParsed = JSON.parse(match[0]);
      } catch {
        throw new IngestError("Model did not return valid JSON", 502);
      }
    }
  }

  const validation = reportDataSchema.safeParse(rawParsed);
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
