import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";
import { ingestReportPdf, IngestError } from "@/lib/ingest-report";

// OCR-ing a 60-90 page PDF plus a dozen-odd parallel DeepSeek calls can
// take several minutes — same reasoning as /api/drive/reparse and
// /api/drive/webhook. This route previously had no maxDuration set at
// all (silently capped at the platform default), which would have timed
// out long before ingestReportPdf finished.
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
