import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// TEMPORARY diagnostic route — returns only structural metadata (key names,
// array lengths, value types) for a report's raw JSON, never actual field
// values/PII. Used to verify a reparse actually produced itemized lifestyle
// data; remove again after checking.
function shapeOf(v: unknown): unknown {
  if (Array.isArray(v)) return { kind: "array", length: v.length, itemKeys: v[0] && typeof v[0] === "object" ? Object.keys(v[0] as object) : typeof v[0] };
  if (v && typeof v === "object") return { kind: "object", keys: Object.keys(v as object) };
  return { kind: typeof v, present: v !== null && v !== undefined };
}

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const row = (await sql`SELECT data, updated_at FROM reports WHERE uid = ${uid}`)[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data = row.data as Record<string, unknown>;
  const vm = data.vitamins_and_minerals;
  let vitaminsShape: unknown;
  if (Array.isArray(vm)) {
    vitaminsShape = shapeOf(vm);
  } else if (vm && typeof vm === "object") {
    vitaminsShape = Object.fromEntries(Object.entries(vm as object).map(([k, v]) => [k, shapeOf(v)]));
  } else {
    vitaminsShape = shapeOf(vm);
  }

  return NextResponse.json({
    updated_at: row.updated_at,
    topLevelKeys: Object.keys(data),
    vitamins_and_minerals: vitaminsShape,
  });
}
