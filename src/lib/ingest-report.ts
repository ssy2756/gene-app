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

3. LIFESTYLE SECTIONS ARE OFTEN UNDER-EXTRACTED — BE THOROUGH, AND NEVER SUBSTITUTE A SUMMARY FOR THE ITEMIZED LIST. "vitamins_and_minerals" and "fitness_and_nutrigenomics" each have dedicated pages with specific, itemized, extractable content — they are not optional or summary sections. A single paragraph describing the page's content (e.g. {"summary": "..."}) is NEVER an acceptable value for vitamins_and_minerals, even if the page also has introductory prose — you MUST find and extract the individual named vitamins/minerals/nutrients underneath that prose, each as its own object with at least a name and dose. For vitamins_and_minerals, produce an array of objects (or an object keyed by tier if the document itself groups them into tiers like Essential/Advised/Optional), each item with: "name" (the vitamin/mineral/nutrient name), "tier" (if tiered), "why" (the genetic reason given), and "dose" (the recommended dose/amount shown). For fitness_and_nutrigenomics: "food_sensitivity" as an array of objects, one per food/substance sensitivity, each with whatever fields the page actually shows (a name/type, the genetic basis, and the sensitivity level/recommendations) — do not omit any individual sensitivity shown. "musculoskeletal" as an object with the fitness/muscle-type profile info actually shown (narrative, risk/level, recommendations). "metabolism" as an array of objects, one per exercise/fitness recommendation area, each with its own recommendation text. If any of these pages exist in the document, this itemized data MUST be present in your output — an empty array or missing field here is only acceptable if that section is genuinely absent from the PDF.

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
