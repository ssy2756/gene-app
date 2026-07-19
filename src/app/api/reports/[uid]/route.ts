import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { mapReportForDisplay } from "@/lib/report-mapping";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const token = request.cookies.get(sessionCookieName)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { uid } = await params;

  const rows = await sql`
    SELECT uid, data FROM reports WHERE uid = ${uid}
  `;
  const report = rows[0];

  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json(mapReportForDisplay(report.uid, report.data));
}
