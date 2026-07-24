import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { ingestReportPdf, IngestError } from "@/lib/ingest-report";

// Extraction is deterministic and fast (no OCR-of-the-whole-document, no
// LLM calls — see src/lib/pdf-extract), but keep a generous ceiling here
// consistent with /api/drive/reparse and /api/drive/webhook.
export const maxDuration = 300;

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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { uid } = await ingestReportPdf(buffer);
    return NextResponse.json({ uid });
  } catch (err) {
    if (err instanceof IngestError) {
      return NextResponse.json({ error: err.message, issues: err.issues }, { status: err.status });
    }
    throw err;
  }
}
