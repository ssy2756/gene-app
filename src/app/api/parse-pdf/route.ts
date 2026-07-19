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

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 16000,
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
            text: `Extract the data from this genomic report PDF as JSON matching this schema:\n\n${JSON.stringify(
              REPORT_JSON_SCHEMA,
              null,
              2
            )}\n\nThe "uid" field is a standalone "UID - <value>" line on page 1, directly below the Name/Age/Gender row. It is a different field from "Genomic Specimen ID" under Sample Details (which is often blank) — do not confuse them.\n\nRespond with ONLY the JSON object, no other text.`,
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
