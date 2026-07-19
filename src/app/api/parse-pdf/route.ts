import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@/lib/db";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { REPORT_JSON_SCHEMA, reportDataSchema } from "@/lib/report-schema";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  // IMPORTANT: these reports render some fields (e.g. the UID) as graphics/vector
  // art with no corresponding text-layer content — a text-extraction pass over
  // the PDF misses them entirely. `type: "document"` makes Claude read the PDF
  // via vision (each page as an image), not just its text layer; the prompt
  // below reinforces that explicitly. Do not swap this for a text-only
  // extraction path (e.g. pdf-parse/pdfplumber piped into a plain text prompt).
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 32000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: `This is a multi-page genomic report PDF (commonly 60-90+ pages). Visually inspect EVERY SINGLE PAGE, from the first page to the last, as an image — do not rely on any embedded/extracted text layer alone, since some fields are rendered graphically and have no text-layer equivalent, and do not stop scanning after the first few pages. Every section of the schema below (condition_risk_overview, medical_recommendations, immune_health, hereditary_cancer_screening, fitness_and_nutrigenomics, vitamins_and_minerals, methylation, pharmacogenomics, diet_plan, appendix, etc.) lives on its own pages later in the document — go through the entire PDF page by page and populate each section from the pages where it actually appears, not just from page 1.\n\nExtract the data as JSON matching this schema:\n\n${JSON.stringify(
              REPORT_JSON_SCHEMA,
              null,
              2
            )}\n\nThe "uid" field is a standalone "UID - <value>" line on page 1, directly below the Name/Age/Gender row, visible only in the rendered page image. It is a different field from "Genomic Specimen ID" under Sample Details (which is often blank) — do not confuse them.\n\nRespond with ONLY the JSON object, no other text.`,
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ error: "No text response from model" }, { status: 502 });
  }

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(textBlock.text);
  } catch {
    return NextResponse.json({ error: "Model did not return valid JSON" }, { status: 502 });
  }

  const validation = reportDataSchema.safeParse(rawParsed);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Parsed JSON failed validation", issues: validation.error.issues },
      { status: 422 }
    );
  }

  const { uid, ...data } = validation.data;

  await sql`
    INSERT INTO reports (uid, data, updated_at)
    VALUES (${uid}, ${JSON.stringify(data)}::jsonb, now())
    ON CONFLICT (uid) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;

  return NextResponse.json({ uid });
}
