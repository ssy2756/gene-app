import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// TEMPORARY diagnostic route — returns only structural metadata (key names,
// array lengths, value types), never actual PII beyond short text fields
// needed to verify extraction quality. Remove again after checking.
export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const row = (await sql`SELECT data, updated_at FROM reports WHERE uid = ${uid}`)[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data = row.data as Record<string, unknown>;
  const fn = data.fitness_and_nutrigenomics as Record<string, unknown> | undefined;

  return NextResponse.json({
    updated_at: row.updated_at,
    fitness_and_nutrigenomics: fn ?? null,
  });
}
