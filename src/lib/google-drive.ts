import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

function getServiceAccountCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  // Accept either a raw JSON string or a base64-encoded JSON string, since
  // pasting a private key with literal newlines into an env var UI is
  // error-prone — base64 sidesteps that entirely.
  const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
  return JSON.parse(json);
}

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: SCOPES,
  });
  return google.drive({ version: "v3", auth });
}

export function getDriveFolderId(): string {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set");
  return folderId;
}

export async function getStartPageToken(): Promise<string> {
  const drive = getDriveClient();
  const res = await drive.changes.getStartPageToken({});
  if (!res.data.startPageToken) throw new Error("Drive API did not return a startPageToken");
  return res.data.startPageToken;
}

export type DriveChange = {
  fileId: string;
  name: string;
  trashed: boolean;
};

async function fetchChangesPage(
  drive: ReturnType<typeof google.drive>,
  pageToken: string,
  folderId: string,
  changes: DriveChange[]
): Promise<string> {
  const res = await drive.changes.list({
    pageToken,
    fields: "nextPageToken,newStartPageToken,changes(fileId,file(id,name,mimeType,parents,trashed))",
  });

  for (const change of res.data.changes ?? []) {
    const file = change.file;
    if (!file || !change.fileId) continue;
    if (file.mimeType !== "application/pdf") continue;
    if (!file.parents?.includes(folderId)) continue;
    changes.push({ fileId: change.fileId, name: file.name ?? change.fileId, trashed: !!file.trashed });
  }

  if (res.data.newStartPageToken) return res.data.newStartPageToken;
  if (!res.data.nextPageToken) {
    // Should be unreachable — Drive always returns newStartPageToken once
    // there's no nextPageToken — but avoid an infinite loop just in case.
    return pageToken;
  }
  return fetchChangesPage(drive, res.data.nextPageToken, folderId, changes);
}

// Fetches all changes since `pageToken`, filtered down to non-trashed PDFs
// that live directly in our target folder. Returns the new page token to
// persist for the next call.
export async function listPdfChangesSince(
  pageToken: string
): Promise<{ changes: DriveChange[]; newPageToken: string }> {
  const drive = getDriveClient();
  const folderId = getDriveFolderId();
  const changes: DriveChange[] = [];
  const newPageToken = await fetchChangesPage(drive, pageToken, folderId, changes);
  return { changes, newPageToken };
}

export async function listPdfsInFolder(): Promise<DriveChange[]> {
  const drive = getDriveClient();
  const folderId = getDriveFolderId();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
    fields: "files(id,name,trashed)",
    pageSize: 1000,
  });
  return (res.data.files ?? []).map((f) => ({ fileId: f.id!, name: f.name ?? f.id!, trashed: !!f.trashed }));
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(res.data as ArrayBuffer);
}

export async function watchChanges(
  pageToken: string,
  webhookUrl: string,
  channelToken: string
): Promise<{ channelId: string; resourceId: string; expiration: string }> {
  const drive = getDriveClient();
  const channelId = crypto.randomUUID();
  // Without an explicit `expiration`, Google defaults new channels to just
  // 1 hour — far too short for a daily renewal cron to keep up with. Request
  // the longest Google allows (currently up to 24h for this API); Google
  // clamps it server-side and returns the real granted value, which we read
  // back from res.data.expiration below.
  const requestedExpiration = String(Date.now() + 24 * 60 * 60 * 1000);
  const res = await drive.changes.watch({
    pageToken,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: webhookUrl,
      token: channelToken,
      expiration: requestedExpiration,
    },
  });
  if (!res.data.resourceId || !res.data.expiration) {
    throw new Error("Drive API did not return resourceId/expiration for the watch channel");
  }
  return { channelId, resourceId: res.data.resourceId, expiration: res.data.expiration };
}
