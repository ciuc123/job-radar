# Job Radar

A private, personal dashboard that finds remote developer roles, scores them against an editable profile, and leaves every application decision to you.

## Stack

- Next.js + TypeScript on Vercel Hobby
- Neon Postgres through the serverless driver
- Drizzle ORM and migrations
- Clerk authentication and Clerk Billing
- Public-repository GitHub Actions for scheduled fetching

The app does not auto-apply. “Apply” always opens the original job page. Rules-based scoring works without AI. Optional AI analysis uses an OpenAI-compatible endpoint and is off by default; daily digest uses Resend and must also be enabled in settings and configured with GitHub Actions secrets. Free plans have changing quotas; do not enable paid overages if maintaining a $0 ceiling matters.

Scoring tiers follow a backend-first pipeline: backend roles enter the pipeline; backend roles mentioning both PHP and Laravel are worth reviewing; strong matches additionally require full remote work and a salary at or above the configured minimum. Configure the salary floor under Preferences; until one is set, no job can qualify as a strong match.

## Local setup

1. Install Node.js 22+ and run `npm install`.
2. Start a local Postgres with `docker compose up -d` or create a Neon project.
3. Create a Clerk development instance and enable Google under **SSO connections → Add connection → For all users**. Development uses Clerk's shared provider credentials.
4. Copy `.env.example` to `.env.local`; set Neon `DATABASE_URL`, Clerk's development publishable/secret keys, and `APP_ADMIN_EMAILS` / `APP_OWNER_EMAIL` to `andrei@ciuculescu.com`.
5. Run `npm run db:migrate` to add Clerk identity mapping, per-user scores, and webhook records, then run `npm run db:seed` if desired.
6. Run `npm run dev` and open `http://localhost:3000/signin`. On first verified sign-in with `andrei@ciuculescu.com`, the existing database user and owned records are linked by email, and the account receives admin and owner Pro flags.

The local Docker database is `postgresql://postgres:jobradar@localhost:5432/jobradar`. Without database credentials, the UI uses sample jobs in read-only demo mode. Mutating actions require a configured database and authenticated user.

After applying migrations and signing in once with `APP_OWNER_EMAIL`, run `npm run network:import` to load `private/network-pipelines.json` into that user's private tracker. The JSON file is git-ignored and must not be committed.

After deploying a scoring-rule change, run `npm run jobs:rescore` once with the production `DATABASE_URL` to update scores for jobs already saved in Neon.

## Deploy

Create a Neon Postgres project and a Vercel project connected to the public GitHub repository. Create a separate Clerk Production instance and use an owned domain; Clerk production cannot use only a `vercel.app` domain. Configure Google production OAuth with the redirect URI Clerk displays in the Google connection settings, then configure Clerk's domain DNS records. Set production Clerk keys only in Vercel Production; use development keys for local and Preview deployments. Run migrations using `npm run db:migrate` with the production `DATABASE_URL` before enabling the app. Add `DATABASE_URL` as a GitHub Actions secret. The scheduled workflow runs at 00:00 and 12:00 Europe/Bucharest time.

Enable Clerk Billing and define a default Free plan plus Pro with features `ai_analysis` and `email_alerts`. Configure `APP_ADMIN_EMAILS=andrei@ciuculescu.com` and `APP_OWNER_EMAIL=andrei@ciuculescu.com` in local and production environments. The admin role is granted only after the matching primary email is verified; the owner setting grants the no-charge Pro override. The `/admin` page is owner-only. Users can send requests through the dashboard support link.

For billing synchronization, add a Clerk webhook endpoint at `/api/webhooks/clerk` and subscribe to `user.created`, `user.updated`, `user.deleted`, and `subscriptionItem.*` lifecycle events. Put the endpoint signing secret in `CLERK_WEBHOOK_SIGNING_SECRET`; the route verifies signatures and deduplicates events. Billing checkout and plan management are available at `/billing`.

Never commit `.env.local`, Clerk secrets, Google OAuth secrets, webhook secrets, or Neon URLs.

## Source availability

Sources are enabled only when they expose an official public API/feed and their terms permit this personal use. Himalayas is supported through its documented public API (up to 10 pages of 20 jobs per run), We Work Remotely through its current public RSS feed, and Jobgether through its documented no-key API (Laravel and PHP searches, up to two pages each). Laravel News Jobs and other sources without a verified permitted feed are recorded as unavailable; Remotive is disabled because its published terms restrict automated extraction and syndication absent permission. No source uses CAPTCHA, login automation, or anti-bot evasion.

The `/network` page is a separate private tracker for platform accounts, talent networks, waitlists, applications, and follow-up reminders. Its data is stored per signed-in user in Neon and should never be added to a public repository fixture. `/sources` shows source availability and fetch health.

For optional AI, configure `AI_ANALYSIS_ENABLED=true`, `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` as GitHub Actions secrets. AI runs only for eligible Pro users on relevant jobs, stores one result per user/job, and uses only that user's candidate profile and the listing text in its prompt. For email, configure `EMAIL_NOTIFICATIONS_ENABLED=true`, `RESEND_API_KEY`, and `EMAIL_FROM` as GitHub Actions secrets; Pro users can then enable the daily digest and/or score threshold alerts in Preferences. Immediate alerts are evaluated each time the scheduled fetch workflow runs. No email is sent by default.

See [PLAN.md](./PLAN.md) for feature status and acceptance criteria.
See [docs/CLERK_SETUP.md](./docs/CLERK_SETUP.md) for exact Clerk, Google OAuth, Billing, webhook, and Vercel setup steps.

# Commands
## Fetch jobs
```bash
npm run jobs:fetch
```