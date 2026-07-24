import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { downloadFile, listPdfChangesSince } from "@/lib/google-drive";
import { ingestReportPdf, IngestError } from "@/lib/ingest-report";

// Vercel's default function timeout is too short for parsing a 90-page
// PDF (OCR pass + a dozen-odd parallel DeepSeek calls). 300 is the hard
// ceiling on the Hobby plan — see reparse/route.ts.
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
  console.log(`[drive/webhook] found ${changes.length} pending PDF change(s):`, changes.map((c) => c.name));

  const results: { fileId: string; name: string; uid?: string; error?: string }[] = [];

  for (const change of changes) {
    if (change.trashed) continue;

    // Google redelivers the same change notification multiple times while a
    // prior invocation is still in flight (observed: 6+ near-simultaneous
    // POSTs for one file). The old check-then-ingest-then-insert sequence
    // left a window where every one of those overlapping requests would
    // see "not yet processed" and all start ingesting the same file at
    // once — wasteful at best, and multiplies OCR worker memory pressure
    // at worst. Claim the file atomically first: only the request whose
    // INSERT actually lands (unique on drive_file_id) proceeds; everyone
    // else sees the conflict and skips immediately.
    const claimed = await sql`
      INSERT INTO processed_drive_files (drive_file_id, uid)
      VALUES (${change.fileId}, 'PENDING')
      ON CONFLICT (drive_file_id) DO NOTHING
      RETURNING drive_file_id
    `;
    if (claimed.length === 0) {
      console.log(`[drive/webhook] skipping already-claimed/processed file: ${change.name}`);
      continue;
    }

    try {
      console.log(`[drive/webhook] downloading and ingesting: ${change.name}`);
      const buffer = await downloadFile(change.fileId);
      const { uid } = await ingestReportPdf(buffer);
      await sql`UPDATE processed_drive_files SET uid = ${uid} WHERE drive_file_id = ${change.fileId}`;
      console.log(`[drive/webhook] ingested ${change.name} -> uid ${uid}`);
      results.push({ fileId: change.fileId, name: change.name, uid });
    } catch (err) {
      // Log server-side unconditionally — this is the only place we'd ever
      // see the failure, since the HTTP response goes back to Google, not us.
      console.error(`[drive/webhook] failed to ingest ${change.name}:`, err);
      const message = err instanceof IngestError ? err.message : "Unknown error";
      results.push({ fileId: change.fileId, name: change.name, error: message });
      // Release the claim so a future retry (manual reparse, or another
      // Drive notification) isn't permanently blocked by a stuck PENDING row.
      await sql`DELETE FROM processed_drive_files WHERE drive_file_id = ${change.fileId} AND uid = 'PENDING'`;
    }
  }

  // Multiple overlapping channels (e.g. a stale one not yet expired after a
  // re-registration) can deliver duplicate/concurrent notifications for the
  // same underlying change. Drive's page tokens are, in practice, increasing
  // decimal strings — guard against an in-flight older request clobbering a
  // newer token a concurrent request already wrote. Falls back to a plain
  // overwrite if either token isn't purely numeric.
  const isNumeric = (s: string) => /^\d+$/.test(s);
  if (isNumeric(state.page_token) && isNumeric(newPageToken)) {
    await sql`
      UPDATE drive_sync_state
      SET page_token = ${newPageToken}, updated_at = now()
      WHERE id = TRUE AND page_token::bigint < ${newPageToken}::bigint
    `;
  } else {
    await sql`UPDATE drive_sync_state SET page_token = ${newPageToken}, updated_at = now() WHERE id = TRUE`;
  }

  return NextResponse.json({ processed: results });
}
