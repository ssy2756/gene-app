import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { downloadFile, listPdfChangesSince } from "@/lib/google-drive";
import { ingestReportPdf, IngestError } from "@/lib/ingest-report";

// Vercel's default function timeout is too short for parsing a 90-page PDF
// via Claude; raise it (requires a paid plan for durations beyond ~60s).
export const maxDuration = 300;

// Google Drive POSTs an empty ping here whenever anything changes in the
// Drive the service account can see — the actual delta must be fetched
// ourselves via `changes.list`. See src/lib/google-drive.ts for the two-step
// watch/notify flow this implements.
export async function POST(request: Request) {
  const channelToken = request.headers.get("x-goog-channel-token");
  const resourceState = request.headers.get("x-goog-resource-state");

  const state = (await sql`SELECT page_token, channel_token FROM drive_sync_state WHERE id = TRUE`)[0];
  if (!state) {
    return NextResponse.json({ error: "No Drive sync state registered" }, { status: 409 });
  }
  if (channelToken !== state.channel_token) {
    return NextResponse.json({ error: "Invalid channel token" }, { status: 401 });
  }

  // "sync" is Google's initial handshake ping when a channel is first
  // created — there's nothing to process yet.
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  const { changes, newPageToken } = await listPdfChangesSince(state.page_token);

  const results: { fileId: string; name: string; uid?: string; error?: string }[] = [];

  for (const change of changes) {
    if (change.trashed) continue;

    const alreadyProcessed = await sql`
      SELECT 1 FROM processed_drive_files WHERE drive_file_id = ${change.fileId}
    `;
    if (alreadyProcessed.length > 0) continue;

    try {
      const buffer = await downloadFile(change.fileId);
      const { uid } = await ingestReportPdf(buffer);
      await sql`
        INSERT INTO processed_drive_files (drive_file_id, uid)
        VALUES (${change.fileId}, ${uid})
        ON CONFLICT (drive_file_id) DO NOTHING
      `;
      results.push({ fileId: change.fileId, name: change.name, uid });
    } catch (err) {
      const message = err instanceof IngestError ? err.message : "Unknown error";
      results.push({ fileId: change.fileId, name: change.name, error: message });
    }
  }

  await sql`UPDATE drive_sync_state SET page_token = ${newPageToken}, updated_at = now() WHERE id = TRUE`;

  return NextResponse.json({ processed: results });
}
