# Gene App

PWA that parses uploaded PDF reports (via the Anthropic API) into structured JSON, stores them in Neon Postgres, and lets users look up their report by UID.

## Status

This is an initial scaffold. Still needed before the app is fully functional:

1. **Sample PDF report with a UID** — to validate the parsing prompt against real data.
2. **Real JSON schema** — replace the placeholder in `src/lib/report-schema.ts`.
3. **UI/UX asset folder** — to replace the placeholder JSON dump on the home page with real, designed `.tsx` components, and to build out `src/lib/report-mapping.ts` with the actual fields each screen needs.
4. **A seeded user** — there's no signup flow by design (users are provisioned, not self-registered); insert a row into `users` manually (see below) to create the first login.

## Setup

```bash
npm install
cp .env.example .env.local
# fill in DATABASE_URL (Neon), ANTHROPIC_API_KEY, SESSION_SECRET
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

- `src/app/api/parse-pdf` — uploads a PDF to the Anthropic API, parses it against `REPORT_JSON_SCHEMA`, upserts into `reports` (keyed by `uid`).
- `src/app/api/reports/[uid]` — looks up a report by UID and returns the display-mapped subset of its JSON.
- `src/app/api/auth/login` / `change-password` — email+password auth with forced password change on first login (`users.must_change_password`).
- `src/lib/report-mapping.ts` — projects the full parsed JSON down to just what the UI needs; currently a placeholder pass-through.
- PWA: `public/manifest.json` + `public/sw.js`, registered via `src/components/ServiceWorkerRegister.tsx`. Icons in `public/icons/` are placeholders — swap for real branding.

## Deploy

Deploy on Vercel and connect a Neon Postgres database via the Vercel integration; set the same env vars (`DATABASE_URL`, `ANTHROPIC_API_KEY`, `SESSION_SECRET`) in the Vercel project settings.
