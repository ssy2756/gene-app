import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getStartPageToken, watchChanges } from "@/lib/google-drive";

// (Re)registers the Drive `changes.watch` channel. Vercel Cron always issues
// a GET request (see vercel.json), which Vercel authenticates automatically
// via an `Authorization: Bearer $CRON_SECRET` header when CRON_SECRET is
// set — the same check also lets this be triggered manually via POST.
async function registerWatch(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const webhookUrl = process.env.DRIVE_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "DRIVE_WEBHOOK_URL is not set" }, { status: 500 });
  }

  const existing = await sql`SELECT page_token FROM drive_sync_state WHERE id = TRUE`;
  const pageToken = existing[0]?.page_token ?? (await getStartPageToken());

  const channelToken = crypto.randomUUID();
  const { channelId, resourceId, expiration } = await watchChanges(pageToken, webhookUrl, channelToken);

  await sql`
    INSERT INTO drive_sync_state (id, page_token, channel_id, resource_id, channel_token, expiration, updated_at)
    VALUES (TRUE, ${pageToken}, ${channelId}, ${resourceId}, ${channelToken}, ${new Date(Number(expiration)).toISOString()}, now())
    ON CONFLICT (id) DO UPDATE SET
      page_token = EXCLUDED.page_token,
      channel_id = EXCLUDED.channel_id,
      resource_id = EXCLUDED.resource_id,
      channel_token = EXCLUDED.channel_token,
      expiration = EXCLUDED.expiration,
      updated_at = now()
  `;

  return NextResponse.json({ channelId, expiration });
}

export const GET = registerWatch;
export const POST = registerWatch;
