import { sql } from "@/lib/db";
import { extractReportPdf, PdfExtractError } from "@/lib/pdf-extract";
import { reportDataSchema } from "@/lib/report-schema";

export class IngestError extends Error {
  status: number;
  issues?: unknown;

  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

// Parses a genomic report PDF and upserts it into `reports` keyed by uid.
// Shared by the manual upload route (src/app/api/parse-pdf/route.ts) and the
// Google Drive ingestion pipeline (src/app/api/drive/webhook,
// scripts/poll-drive.ts) so there is exactly one place that defines how a
// PDF becomes a stored report.
//
// Extraction is fully deterministic (src/lib/pdf-extract) — no OCR-of-the-
// whole-document and no LLM calls. A diagnostic pass established that this
// document type has a real PDF text layer for everything except the page-1
// "UID"/"Age" fields (genuinely flattened vector art from the PowerPoint
// export), which get a small targeted OCR crop instead of full-document
// OCR. This replaced an OCR(whole doc)+DeepSeek pipeline that repeatedly
// produced unstable output on the same document (vitamins tier
// mis-assignment, uid drift, and — most recently — food-sensitivity gene
// lists fabricated wholesale, since no gene data exists in that section of
// the source at all).
//
// expectedUid: the "UID - <value>" line is read via OCR and can misread
// occasionally — when the caller already knows the uid (reparsing an
// existing report), pass it here to use directly instead of trusting
// extraction, so a misread never silently creates a new row under the
// wrong key. Only a first-time Drive-triggered ingest has no expected uid.
export async function ingestReportPdf(pdfBuffer: Buffer, expectedUid?: string): Promise<{ uid: string }> {
  let extracted: Record<string, unknown>;
  try {
    extracted = await extractReportPdf(pdfBuffer);
  } catch (err) {
    if (err instanceof PdfExtractError) {
      throw new IngestError(err.message, 422);
    }
    throw err;
  }

  const { uid: extractedUid, ...data } = extracted;
  const uid = expectedUid ?? (typeof extractedUid === "string" && extractedUid ? extractedUid : null);
  if (!uid) {
    throw new IngestError("Could not determine report uid (OCR crop failed and no expectedUid was given)", 422);
  }

  const validation = reportDataSchema.safeParse({ uid, ...data });
  if (!validation.success) {
    throw new IngestError("Extracted data failed validation", 422, validation.error.issues);
  }

  const validatedData: Record<string, unknown> = { ...validation.data };
  delete validatedData.uid;

  await sql`
    INSERT INTO reports (uid, data, updated_at)
    VALUES (${uid}, ${JSON.stringify(validatedData)}::jsonb, now())
    ON CONFLICT (uid) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;

  return { uid };
}
