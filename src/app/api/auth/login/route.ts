import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { createSessionToken, sessionCookieName, sessionMaxAge } from "@/lib/auth";

const bodySchema = z.object({
  uid: z.string().min(1),
});

// Simplified login: entering a valid report UID logs you in directly, no
// email/password yet. To be replaced with real account credentials later.
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { uid } = parsed.data;

  const report = (await sql`SELECT uid FROM reports WHERE uid = ${uid}`)[0];
  if (!report) {
    return NextResponse.json({ error: "No report found for this UID" }, { status: 404 });
  }

  const token = await createSessionToken({ uid: report.uid });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge,
  });
  return response;
}
