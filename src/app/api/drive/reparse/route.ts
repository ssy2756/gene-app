import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { downloadFile } from "@/lib/google-drive";
import { ingestReportPdf, IngestError } from "@/lib/ingest-report";

// Parsing a multi-page PDF via OpenAI can take well over Vercel's default
// serverless timeout — same as /api/drive/webhook.
export const maxDuration = 300;

// Re-runs ingestion for a report that's already been processed once, using
// the same Drive file (looked up via processed_drive_files by uid) rather
// than waiting for a new Drive change event — useful after a prompt/schema
// fix when the original extraction is known to be stale/wrong. Same
// CRON_SECRET auth pattern as /api/drive/register-watch (checked on both
// GET and POST since this triggers a real write + external API call).
async function handle(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ error: "uid query param required" }, { status: 400 });
  }

  const row = (await sql`SELECT drive_file_id FROM processed_drive_files WHERE uid = ${uid}`)[0];
  if (!row) {
    return NextResponse.json({ error: "No processed Drive file recorded for this uid" }, { status: 404 });
  }

  try {
    const buffer = await downloadFile(row.drive_file_id);
    const result = await ingestReportPdf(buffer);
    return NextResponse.json({ ok: true, uid: result.uid });
  } catch (err) {
    if (err instanceof IngestError) {
      return NextResponse.json({ error: err.message, issues: err.issues }, { status: err.status });
    }
    console.error("Reparse failed:", err);
    return NextResponse.json({ error: "Reparse failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
