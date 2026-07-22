# GenepowerX report app

PWA that parses genomic report PDFs (via the OpenAI API, vision-based) into structured JSON, stores them in Neon Postgres, and lets users look up their report by UID. PDFs arrive automatically via a Google Drive drop folder (staff upload there, not through the app) rather than manual upload, though a manual upload sheet also exists as an admin fallback.

## Status

Core app (auth, PDF parsing, UID lookup, full UI) is built. Still needed to go live:

1. **Deploy to Vercel + connect Neon**, run `db/schema.sql`, set env vars.
2. **A seeded user** — there's no signup flow by design (users are provisioned, not self-registered); insert a row into `users` manually (see below).
3. **Google Cloud project + service account** for the Drive ingestion pipeline (see "Google Drive setup" below) — required before PDFs dropped in Drive can be auto-parsed.
4. **An OpenAI API key.**

## Setup

```bash
npm install
cp .env.example .env.local
# fill in DATABASE_URL (Neon), OPENAI_API_KEY, SESSION_SECRET
```

Apply the schema to your Neon database:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Seed a first user (password must be hashed with bcrypt beforehand):

```sql
INSERT INTO users (email, password_hash, must_change_password)
VALUES ('someone@example.com', '<bcrypt-hash>', TRUE);
```

Run the dev server:

```bash
npm run dev
```

## Architecture

- `src/lib/ingest-report.ts` — the single place that turns a PDF buffer into a stored report: sends it to OpenAI (`gpt-4o` by default, override via `OPENAI_MODEL`) as a vision `input_file` (see the comment there and in `AGENTS.md` — full-document scan, never a text-only extraction path), validates against `reportDataSchema` (`src/lib/report-schema.ts`), upserts into `reports` keyed by `uid`.
- `src/app/api/parse-pdf` — manual upload path (admin fallback / in-app Upload sheet), calls `ingestReportPdf`.
- `src/app/api/drive/webhook` + `src/app/api/drive/register-watch` — the primary ingestion path: Google Drive push notifications trigger parsing automatically when staff drop a PDF into a shared folder. See "Google Drive setup" below.
- `scripts/poll-drive.ts` (`npm run poll-drive`) — local-testing alternative to the webhook (no public URL needed): lists PDFs in the target folder and ingests anything new.
- `src/app/api/reports/[uid]` — looks up a report by UID and returns the display-mapped subset of its JSON.
- `src/app/api/auth/login` / `change-password` — email+password auth with forced password change on first login (`users.must_change_password`).
- `src/lib/report-mapping.ts` — projects the full parsed JSON down to per-screen view models for the UI in `src/components/report/`.
- PWA: `public/manifest.json` + `public/sw.js`, registered via `src/components/ServiceWorkerRegister.tsx`; icons in `public/icons/` are branded (DNA helix on GenepowerX purple).

## Google Drive setup

The Drive ingestion pipeline needs, once:

1. A Google Cloud project with the **Drive API** enabled (free — no Workspace/business account required).
2. A **Service Account** in that project, with a JSON key generated.
3. A Drive folder (a regular personal Drive is fine) for staff to drop PDFs into, **shared with the service account's email** (`...@project-id.iam.gserviceaccount.com`) like any other collaborator.
4. That folder's ID (from its URL) as `GOOGLE_DRIVE_FOLDER_ID`.
5. The service account JSON key as `GOOGLE_SERVICE_ACCOUNT_KEY` (raw JSON or base64-encoded — see `src/lib/google-drive.ts`).

Before deployment, validate the pipeline locally with `npm run poll-drive` (polls the folder directly, no public URL needed). Once deployed, set `DRIVE_WEBHOOK_URL` to `https://<your-domain>/api/drive/webhook` and call `POST /api/drive/register-watch` once to start real-time notifications. `vercel.json` schedules a daily re-registration (`CRON_SECRET` protects it) since Drive watch channels expire and don't renew themselves.

## Deploy

Deploy on Vercel and connect a Neon Postgres database via the Vercel integration; set the env vars in `.env.example` in the Vercel project settings.
