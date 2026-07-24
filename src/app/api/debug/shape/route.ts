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
  const pgx = data.pharmacogenomics as Record<string, unknown> | undefined;
  return NextResponse.json({
    uid: row.uid,
    updated_at: row.updated_at,
    topLevelKeys: Object.keys(data),
    patient_information: data.patient_information,
    condition_risk_overview_count: (data.condition_risk_overview as unknown[] | undefined)?.length,
    medical_recommendations_count: (data.medical_recommendations as unknown[] | undefined)?.length,
    vitamins_count: (data.vitamins_and_minerals as unknown[] | undefined)?.length,
    vitamins: data.vitamins_and_minerals,
    methylation_count: (data.methylation_markers as unknown[] | undefined)?.length,
    diplotypes_count: (pgx?.diplotypes as unknown[] | undefined)?.length,
    drug_recommendations_count: (pgx?.drug_recommendations as unknown[] | undefined)?.length,
    food_sensitivity: (data.fitness_and_nutrigenomics as Record<string, unknown> | undefined)?.food_sensitivity,
    exercise_count: ((data.fitness_and_nutrigenomics as Record<string, unknown> | undefined)?.exercise as unknown[] | undefined)?.length,
    references_count: (data.references as unknown[] | undefined)?.length,
    biomarkers_analyzed_count: (data.biomarkers_analyzed as unknown[] | undefined)?.length,
    diet_plan_recommendations_count: (data.diet_plan_recommendations as unknown[] | undefined)?.length,
  });
}
