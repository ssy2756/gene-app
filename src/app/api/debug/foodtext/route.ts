import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { downloadFile } from "@/lib/google-drive";
import { extractPdfTextViaOcr } from "@/lib/pdf-ocr";

// Temporary read-only inspection route — remove once no longer needed.
// Pulls the raw OCR text around "Your Metabolism" so we can see exactly
// what the source report prints for food sensitivities, instead of
// guessing from the LLM's (possibly wrong) extracted output.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ error: "uid query param required" }, { status: 400 });
  }
  const row = (await sql`SELECT drive_file_id FROM processed_drive_files WHERE uid = ${uid}`)[0];
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const buffer = await downloadFile(row.drive_file_id);
  const text = await extractPdfTextViaOcr(buffer);
  const idx = text.search(/your metabolism/i);
  if (idx === -1) {
    return NextResponse.json({ error: "'Your Metabolism' not found in OCR text", length: text.length });
  }
  const snippet = text.slice(Math.max(0, idx - 200), idx + 4000);
  return NextResponse.json({ snippet });
}
