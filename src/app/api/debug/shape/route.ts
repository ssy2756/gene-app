import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// TEMPORARY diagnostic route — returns raw vitamins_and_minerals data to
// verify tier extraction. Remove again after checking.
export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const row = (await sql`SELECT data, updated_at FROM reports WHERE uid = ${uid}`)[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data = row.data as Record<string, unknown>;

  return NextResponse.json({
    updated_at: row.updated_at,
    vitamins_and_minerals: data.vitamins_and_minerals ?? null,
  });
}
