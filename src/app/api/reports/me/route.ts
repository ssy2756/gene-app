import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { mapReportForDisplay } from "@/lib/report-mapping";

// Returns the report linked to the currently logged-in account (via
// users.uid, set at registration time) — the primary path the app uses
// after login, so a returning user never has to re-enter their UID.
export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rows = await sql`SELECT uid, data FROM reports WHERE uid = ${session.uid}`;
  const report = rows[0];

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json(mapReportForDisplay(report.uid, report.data));
}
