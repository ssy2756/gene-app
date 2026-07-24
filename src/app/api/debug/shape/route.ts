import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

function shapeOf(v: unknown): unknown {
  if (Array.isArray(v)) {
    return {
      kind: "array",
      length: v.length,
      itemKeys: v[0] && typeof v[0] === "object" ? Object.keys(v[0] as object) : typeof v[0],
    };
  }
  if (v && typeof v === "object") return { kind: "object", keys: Object.keys(v as object) };
  return { kind: typeof v, present: v !== null && v !== undefined };
}

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const row = (await sql`SELECT data, updated_at FROM reports WHERE uid = ${uid}`)[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data = row.data as Record<string, unknown>;
  const pgx = data.pharmacogenomics as Record<string, unknown> | undefined;

  return NextResponse.json({
    updated_at: row.updated_at,
    topLevelKeys: Object.keys(data),
    patient_information: data.patient_information,
    care_plan: shapeOf(data.care_plan),
    vitamins_and_minerals: data.vitamins_and_minerals,
    pharmacogenomics: pgx
      ? { keys: Object.keys(pgx), diplotypes: shapeOf(pgx.diplotypes), drug_recommendations: shapeOf(pgx.drug_recommendations) }
      : null,
  });
}
