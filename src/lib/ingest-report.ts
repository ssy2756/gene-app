import OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
import { sql } from "@/lib/db";
import { REPORT_JSON_SCHEMA, reportDataSchema } from "@/lib/report-schema";

// Diagnostic logging for the "Model did not return valid JSON" failure —
// most commonly caused by hitting max_output_tokens mid-object (the
// response gets cut off, so it's well-formed-looking but incomplete JSON).
// Vercel truncates long log lines, so this logs the status/incomplete
// reason plus just the tail of the text (where truncation would show).
function logInvalidJson(response: Response, text: string) {
  console.error(
    "Ingest: invalid JSON from model.",
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

  const response = await getOpenAI().responses.create({
    model: MODEL,
    max_output_tokens: 16000,
    // Forces valid JSON output. Without this, some models wrap the JSON in
    // markdown code fences or add stray prose despite the prompt saying not
    // to — this makes it a hard API-level guarantee instead of a request.
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
            text: `use this schema and extract the pdf into a json:\n\n${JSON.stringify(
              REPORT_JSON_SCHEMA,
              null,
              2
            )}\n\nRespond with ONLY the JSON object, no other text.`,
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
        logInvalidJson(response, text);
        throw new IngestError("Model did not return valid JSON", 502);
      }
      try {
        rawParsed = JSON.parse(match[0]);
      } catch {
        logInvalidJson(response, text);
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
