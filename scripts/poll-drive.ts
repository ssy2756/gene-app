// Local-testing-only alternative to the real-time Drive webhook
// (src/app/api/drive/webhook/route.ts). Since Drive's push notifications
// require a public HTTPS URL, this script lets you validate the full
// Drive -> parse -> Neon pipeline before deployment by simply listing PDFs
// in the target folder and ingesting anything not already processed.
//
// Usage: npx tsx scripts/poll-drive.ts
// Requires the same env vars as the app: DATABASE_URL, ANTHROPIC_API_KEY,
// GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_DRIVE_FOLDER_ID.

import { sql } from "../src/lib/db";
import { downloadFile, listPdfsInFolder } from "../src/lib/google-drive";
import { ingestReportPdf, IngestError } from "../src/lib/ingest-report";

async function main() {
  const files = await listPdfsInFolder();
  console.log(`Found ${files.length} PDF(s) in the target folder.`);

  for (const file of files) {
    const alreadyProcessed = await sql`
      SELECT 1 FROM processed_drive_files WHERE drive_file_id = ${file.fileId}
    `;
    if (alreadyProcessed.length > 0) {
      console.log(`Skipping "${file.name}" (already processed).`);
      continue;
    }

    console.log(`Processing "${file.name}"...`);
    try {
      const buffer = await downloadFile(file.fileId);
      const { uid } = await ingestReportPdf(buffer);
      await sql`
        INSERT INTO processed_drive_files (drive_file_id, uid)
        VALUES (${file.fileId}, ${uid})
        ON CONFLICT (drive_file_id) DO NOTHING
      `;
      console.log(`  -> stored as uid ${uid}`);
    } catch (err) {
      const message = err instanceof IngestError ? `${err.message} (status ${err.status})` : String(err);
      console.error(`  -> failed: ${message}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
