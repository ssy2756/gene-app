import OpenAI from "openai";
import { sql } from "@/lib/db";
import { extractPdfTextViaOcr } from "@/lib/pdf-ocr";
import { GENE_REPORT_SCHEMA, PHARMACOGENOMICS_SCHEMA, reportDataSchema } from "@/lib/report-schema";

// DeepSeek's API is OpenAI-SDK-compatible (chat completions), just served
// from a different base URL — no vision/file input support, hence the OCR
// pass in pdf-ocr.ts feeding it plain text instead.
let deepseekClient: OpenAI | null = null;
function getDeepSeek(): OpenAI {
  if (!deepseekClient) {
    deepseekClient = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
  }
  return deepseekClient;
}

const MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

export class IngestError extends Error {
  status: number;
  issues?: unknown;

  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

// Diagnostic logging for the "Model did not return valid JSON" failure —
// most commonly caused by hitting the output token cap mid-object (the
// response gets cut off, so it's well-formed-looking but incomplete JSON).
// Vercel truncates long log lines, so this logs just the finish reason and
// the tail of the text (where truncation would show).
function logInvalidJson(label: string, finishReason: string | undefined, text: string) {
  console.error(
    `Ingest[${label}]: invalid JSON from model.`,
    "finish_reason:",
    finishReason,
    "output length (chars):",
    text.length,
    "last 500 chars:",
    text.slice(-500)
  );
}

const GENE_REPORT_PROMPT_BASE =
  "Extract all data from this GenepoweRx genetic report (its full text, OCR-extracted from the " +
  "source PDF, is below) into JSON matching the schema given, following the field names in the " +
  "schema exactly. Do NOT include the pharmacogenomics section — that is extracted separately. " +
  "The OCR text may contain minor recognition errors (misread characters, stray line breaks) — " +
  "use context to correct obvious ones. The uid is the Genomic Specimen ID printed on the " +
  "report; if it is blank, use the patient name alone (do not invent a placeholder for a " +
  "missing collection date). Preserve every condition, risk level, gene, and recommendation you " +
  "find — do not summarize or drop rows. The report does not print a body system per condition, " +
  "so classify each condition's body_system yourself using standard medical knowledge, from the " +
  "enum given in the schema. care_plan is not a section of the report — synthesize it from the " +
  "'monitor X every Y' style actions already present in medical_recommendations and elsewhere, " +
  "deduplicating repeated actions across conditions. For the Lifestyle section: 'exercise' must " +
  "come ONLY from the 'Exercise' subsection of the 'Tailored Fitness: Musculoskeletal Resilience " +
  "for Every Step' page — never from 'Medical Recommendations' or 'Diet and Nutrition'. " +
  "'food_sensitivity' must come from the separate 'Your Metabolism' section — this is a " +
  "different section from Exercise, do not confuse them, and food_sensitivity must not be left " +
  "empty if that section exists. 'vitamins_and_minerals' MUST be a JSON array directly (e.g. " +
  "\"vitamins_and_minerals\": [{...}, {...}]) — do NOT wrap it in an object with an 'items'/" +
  "'list' key. Extract the itemized list under the 'Vitamins and Minerals Summary' page as " +
  "individual items; EVERY item MUST include a non-empty 'tier' field with the tier label " +
  "exactly as printed in the text immediately above it — the OCR text preserves the document's " +
  "top-to-bottom reading order, so assign each item to the nearest tier label that appears " +
  "before it in the text, not to a tier assumed from habit or list position. A tier label can " +
  "appear in the text with zero items listed after it before the next tier label — that is " +
  "valid, leave it with no items, never invent items to fill it.";

const PHARMACOGENOMICS_PROMPT_BASE =
  "This report has a large Pharmacogenomics (PGx) section spanning many pages of the document " +
  "text below (OCR-extracted from the source PDF): a gene diplotype panel, then per-drug-class " +
  "tables of individual drug rows (molecule class, drug name, level of evidence, response " +
  "category/mechanism, clinical recommendation), then a therapeutic summary. The OCR text may " +
  "contain minor recognition errors — use context to correct obvious ones. Extract every single " +
  "diplotype row and every single drug row into JSON matching the schema given — there are " +
  "typically 300+ drug rows across dozens of drug classes (antiplatelets, anticoagulants, " +
  "antihypertensives, diabetic drugs, statins, PPIs, antiemetics, painkillers, asthma meds, " +
  "anti-inflammatories, anti-epileptics, opioids, psychiatric drugs, antivirals, transplant " +
  "drugs, etc.). Do not summarize, sample, or truncate the list — go through the PGx section " +
  "class by class and row by row.";

function buildPrompt(base: string, schema: object, documentText: string): string {
  return `${base}

Extract the data as JSON matching this schema:

${JSON.stringify(schema, null, 2)}

Document text (OCR-extracted from the PDF):

${documentText}

Respond with ONLY the JSON object, no other text.`;
}

function parseJsonResponse(label: string, finishReason: string | undefined, text: string | null | undefined): unknown {
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
        logInvalidJson(label, finishReason, text);
        throw new IngestError("Model did not return valid JSON", 502);
      }
      try {
        return JSON.parse(match[0]);
      } catch {
        logInvalidJson(label, finishReason, text);
        throw new IngestError("Model did not return valid JSON", 502);
      }
    }
  }
}

// Runs one DeepSeek extraction call with the given prompt (which already
// includes the OCR'd document text) and returns the parsed JSON object.
async function extract(label: string, prompt: string): Promise<Record<string, unknown>> {
  const response = await getDeepSeek().chat.completions.create({
    model: MODEL,
    max_tokens: 8000,
    // Forces valid JSON output. Without this, models sometimes wrap the
    // JSON in markdown code fences or add stray prose despite the prompt
    // saying not to — this makes it a hard API-level guarantee instead of
    // a request.
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const choice = response.choices[0];
  const parsed = parseJsonResponse(label, choice?.finish_reason, choice?.message?.content);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new IngestError("Model did not return a JSON object", 502);
  }
  return parsed as Record<string, unknown>;
}

// Parses a genomic report PDF via OCR (pdf-ocr.ts) followed by two DeepSeek
// calls (main report, then pharmacogenomics separately), merges and
// validates the result, and upserts it into `reports` keyed by uid. Shared
// by the manual upload route (src/app/api/parse-pdf/route.ts) and the
// Google Drive ingestion pipeline (src/app/api/drive/webhook,
// scripts/poll-drive.ts) so there is exactly one place that defines how a
// PDF becomes a stored report.
export async function ingestReportPdf(pdfBuffer: Buffer): Promise<{ uid: string }> {
  const documentText = await extractPdfTextViaOcr(pdfBuffer);

  const [mainData, pharmacogenomics] = await Promise.all([
    extract("gene_report", buildPrompt(GENE_REPORT_PROMPT_BASE, GENE_REPORT_SCHEMA, documentText)),
    extract("pharmacogenomics", buildPrompt(PHARMACOGENOMICS_PROMPT_BASE, PHARMACOGENOMICS_SCHEMA, documentText)),
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
