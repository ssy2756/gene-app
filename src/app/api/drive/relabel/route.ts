import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// One-time corrective action: when a uid-extraction bug causes a Drive file
// to get recorded under the wrong uid in processed_drive_files (e.g. an
// OCR/prompt bug made a report land under the patient's name instead of
// its real UID), this renames the processed_drive_files mapping so a
// subsequent /api/drive/reparse?uid=<correct> can find the right Drive
// file. Does not touch the `reports` table (the reparse re-ingest, with
// the fixed uid passed through as expectedUid, will create the correctly
// keyed row itself). Same CRON_SECRET auth pattern as /api/drive/reparse.
// Temporary — remove once no longer needed.
async function handle(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const oldUid = request.nextUrl.searchParams.get("from");
  const newUid = request.nextUrl.searchParams.get("to");
  if (!oldUid || !newUid) {
    return NextResponse.json({ error: "from and to query params required" }, { status: 400 });
  }

  await sql`UPDATE processed_drive_files SET uid = ${newUid} WHERE uid = ${oldUid}`;

  return NextResponse.json({ ok: true });
}

export const GET = handle;
export const POST = handle;
