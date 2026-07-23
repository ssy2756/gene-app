import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// TEMPORARY diagnostic route — returns structural metadata (key names,
// array lengths) plus a few key fields, never full PII. Remove again after
// checking.
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
  const pgx = data.pharmacogenomics as Record<string, unknown> | undefined;

  return NextResponse.json({
    updated_at: row.updated_at,
    topLevelKeys: Object.keys(data),
    condition_risk_overview: shapeOf(data.condition_risk_overview),
    medical_recommendations: shapeOf(data.medical_recommendations),
    care_plan: shapeOf(data.care_plan),
    vitamins_and_minerals: shapeOf(data.vitamins_and_minerals),
    fitness_and_nutrigenomics: shapeOf(data.fitness_and_nutrigenomics),
    pharmacogenomics: pgx
      ? {
          keys: Object.keys(pgx),
          diplotypes: shapeOf(pgx.diplotypes),
          drug_recommendations: shapeOf(pgx.drug_recommendations),
        }
      : null,
    sampleCondition: Array.isArray(data.condition_risk_overview) ? data.condition_risk_overview[0] : null,
    sampleCarePlan: Array.isArray(data.care_plan) ? data.care_plan.slice(0, 3) : null,
  });
}
