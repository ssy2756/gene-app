import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// TEMPORARY diagnostic route — returns only structural metadata (key names,
// array lengths, value types) for a report's raw JSON, never actual field
// values/PII. Added to debug why the Lifestyle tab renders empty for real
// reports; remove once resolved.
function shapeOf(v: unknown): unknown {
  if (Array.isArray(v)) return { kind: "array", length: v.length, itemKeys: v[0] && typeof v[0] === "object" ? Object.keys(v[0] as object) : typeof v[0] };
  if (v && typeof v === "object") return { kind: "object", keys: Object.keys(v as object) };
  return { kind: typeof v, present: v !== null && v !== undefined };
}

export async function GET(request: NextRequest) {
  const uid = request.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

  const row = (await sql`SELECT data FROM reports WHERE uid = ${uid}`)[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data = row.data as Record<string, unknown>;
  return NextResponse.json({
    topLevelKeys: Object.keys(data),
    vitamins_and_minerals: shapeOf(data.vitamins_and_minerals),
    fitness_and_nutrigenomics: data.fitness_and_nutrigenomics
      ? {
          kind: "object",
          keys: Object.keys(data.fitness_and_nutrigenomics as object),
          metabolism: shapeOf((data.fitness_and_nutrigenomics as Record<string, unknown>).metabolism),
          food_sensitivity: shapeOf((data.fitness_and_nutrigenomics as Record<string, unknown>).food_sensitivity),
          musculoskeletal: shapeOf((data.fitness_and_nutrigenomics as Record<string, unknown>).musculoskeletal),
        }
      : { kind: typeof data.fitness_and_nutrigenomics, present: false },
  });
}
