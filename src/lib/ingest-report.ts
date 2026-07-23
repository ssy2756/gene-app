import OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
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

// Diagnostic logging for the "Model did not return valid JSON" failure —
// most commonly caused by hitting max_output_tokens mid-object (the
// response gets cut off, so it's well-formed-looking but incomplete JSON).
// Vercel truncates long log lines, so this logs the status/incomplete
// reason plus just the tail of the text (where truncation would show).
function logInvalidJson(label: string, response: Response, text: string) {
  console.error(
    `Ingest[${label}]: invalid JSON from model.`,
    "status:",
    response.status,
    "incomplete_details:",
    response.incomplete_details,
    "output length (chars):",
    text.length,
    "last 500 chars:",
    text.slice(-500)
  );
}

// Verbatim, as provided — do not append additional accuracy rules or
// preambles here. Only the schema JSON + final response-format line are
// appended below, since the model still needs the field-name schema and
// a plain-JSON-only instruction to satisfy the json_object response mode.
const GENE_REPORT_PROMPT_BASE =
  "Extract all data from this GenepoweRx genetic report PDF into the record_gene_report tool " +
  "call, following the field names in the tool schema exactly (snake_case, matching " +
  "genepowerx_report_extracted.json). Do NOT include the pharmacogenomics section — that is " +
  "extracted separately. The uid is the Genomic Specimen ID printed on the report; if it is " +
  "blank, use the patient name alone (do not invent a placeholder for a missing collection " +
  "date). Preserve every condition, risk level, gene, and recommendation you find — do not " +
  "summarize or drop rows. Do not fabricate the appendix/glossary reference tables — omit them " +
  "if not asked. The report does not print a body system per condition, so classify each " +
  "condition's body_system yourself using standard medical knowledge. care_plan is not a " +
  "section of the report — synthesize it from the 'monitor X every Y' style actions already " +
  "present in medical_recommendations and elsewhere, deduplicating repeated actions across " +
  "conditions.";

const PHARMACOGENOMICS_PROMPT_BASE =
  "This report has a large Pharmacogenomics (PGx) section spanning many pages: a gene " +
  "diplotype panel, then per-drug-class tables of individual drug rows (molecule class, drug " +
  "name, level of evidence, response category/mechanism, clinical recommendation), then a " +
  "therapeutic summary. Extract every single diplotype row and every single drug row into the " +
  "record_pharmacogenomics tool call — there are typically 300+ drug rows across dozens of drug " +
  "classes (antiplatelets, anticoagulants, antihypertensives, diabetic drugs, statins, PPIs, " +
  "antiemetics, painkillers, asthma meds, anti-inflammatories, anti-epileptics, opioids, " +
  "psychiatric drugs, antivirals, transplant drugs, etc.). Do not summarize, sample, or truncate " +
  "the list — go through the PGx section class by class and row by row.";

const GENE_REPORT_PROMPT = `${GENE_REPORT_PROMPT_BASE}

Extract the data as JSON matching this schema:

${JSON.stringify(GENE_REPORT_SCHEMA, null, 2)}

Respond with ONLY the JSON object, no other text.`;

const PHARMACOGENOMICS_PROMPT = `${PHARMACOGENOMICS_PROMPT_BASE}

Extract the data as JSON matching this schema:

${JSON.stringify(PHARMACOGENOMICS_SCHEMA, null, 2)}

Respond with ONLY the JSON object, no other text.`;

function parseJsonResponse(label: string, response: Response): unknown {
  const text = response.output_text;
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
        logInvalidJson(label, response, text);
        throw new IngestError("Model did not return valid JSON", 502);
      }
      try {
        return JSON.parse(match[0]);
      } catch {
        logInvalidJson(label, response, text);
        throw new IngestError("Model did not return valid JSON", 502);
      }
    }
  }
}

// Runs one PDF-vision extraction call with the given prompt and returns the
// parsed JSON object.
async function extract(label: string, pdfBase64: string, prompt: string): Promise<Record<string, unknown>> {
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

  const parsed = parseJsonResponse(label, response);
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
    extract("gene_report", pdfBase64, GENE_REPORT_PROMPT),
    extract("pharmacogenomics", pdfBase64, PHARMACOGENOMICS_PROMPT),
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
