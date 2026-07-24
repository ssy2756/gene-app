import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Temporary read-only inspection route — remove once no longer needed.
export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) {
    return NextResponse.json({ error: "uid query param required" }, { status: 400 });
  }
  const rows = await sql`SELECT uid, updated_at, data FROM reports WHERE uid = ${uid}`;
  if (rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const row = rows[0];
  const data = row.data as Record<string, unknown>;
  return NextResponse.json({
    uid: row.uid,
    updated_at: row.updated_at,
    condition_risk_overview_count: (data.condition_risk_overview as unknown[] | undefined)?.length,
    conditions: (data.condition_risk_overview as Record<string, unknown>[] | undefined)?.map((c) => ({
      condition: c.condition,
      risk_level: c.risk_level,
      body_system: c.body_system,
    })),
  });
}
