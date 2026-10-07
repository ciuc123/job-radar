# Job Radar

A private, personal dashboard that finds remote developer roles, scores them against an editable profile, and leaves every application decision to you.

## Stack

- Next.js + TypeScript on Vercel Hobby
- Neon Postgres through the serverless driver
- Drizzle ORM and migrations
- Google OAuth via Auth.js
- Public-repository GitHub Actions for scheduled fetching

The app does not auto-apply. “Apply” always opens the original job page. Rules-based scoring works without AI. Optional AI analysis uses an OpenAI-compatible endpoint and is off by default; daily digest uses Resend and must also be enabled in settings and configured with GitHub Actions secrets. Free plans have changing quotas; do not enable paid overages if maintaining a $0 ceiling matters.

## Local setup

1. Install Node.js 22+ and run `npm install`.
2. Start a local Postgres with `docker compose up -d` or create a Neon project.
3. Copy `.env.example` to `.env.local` and fill in the database and Google OAuth values.
4. Set the Google OAuth redirect URI to `${APP_URL}/api/auth/callback/google` and set `ALLOWED_EMAIL` to your Google account.
5. Run `npm run db:migrate` and `npm run db:seed`.
6. Run `npm run dev` and open `http://localhost:3000`.

The local Docker database is `postgresql://postgres:jobradar@localhost:5432/jobradar`. Without database credentials, the UI uses sample jobs in read-only demo mode. Mutating actions require a configured database and authenticated user.

## Deploy

Create a Neon Postgres project and a Vercel project connected to the public GitHub repository. Set the variables from `.env.example` in Vercel. Run migrations using `npm run db:migrate` with the production `DATABASE_URL` before enabling the app. Add `DATABASE_URL` as a GitHub Actions secret. The scheduled workflow runs once each morning UTC; it can also be triggered manually from Actions.

Google sign-in requires OAuth client credentials. Restrict the OAuth consent audience and authorized users to your own account. Never commit `.env.local`, provider secrets, or Neon URLs.

## Source availability

Sources are enabled only when they expose an official public API/feed and their terms permit this personal use. Himalayas is supported through its documented public API and We Work Remotely through its public RSS feed. Laravel News Jobs and other sources without a verified permitted feed are recorded as unavailable; Remotive is disabled because its published terms restrict automated extraction and syndication absent permission. No source uses CAPTCHA, login automation, or anti-bot evasion.

The `/network` page is a separate private tracker for platform accounts, talent networks, waitlists, applications, and follow-up reminders. Its data is stored per signed-in user in Neon and should never be added to a public repository fixture. `/sources` shows source availability and fetch health.

For optional AI, configure `AI_ANALYSIS_ENABLED=true`, `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` as GitHub Actions secrets. AI runs only on high scoring jobs, stores one result per job, and uses only the candidate profile and listing text in its prompt. For email, configure `EMAIL_NOTIFICATIONS_ENABLED=true`, `RESEND_API_KEY`, and `EMAIL_FROM` as GitHub Actions secrets, then enable the daily digest and/or score threshold alerts in Preferences. Immediate alerts are evaluated each time the scheduled fetch workflow runs. No email is sent by default.

See [PLAN.md](./PLAN.md) for feature status and acceptance criteria.
