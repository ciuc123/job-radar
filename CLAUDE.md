# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` / `npm run build` / `npm run lint`
- `npm test` — Node's built-in runner via tsx (`tests/*.test.ts`). Single file: `node --import tsx --test tests/scoring.test.ts`
- `npm run db:generate` (drizzle-kit, output in `drizzle/`), `npm run db:migrate`, `npm run db:seed`
- `npm run jobs:fetch` — run the fetch pipeline against `DATABASE_URL`
- `npm run jobs:rescore` — re-score saved jobs (run once in production after changing scoring rules)
- `npm run notifications:send` — digests/alerts via Resend
- `npm run network:import` — load git-ignored `private/network-pipelines.json` into the owner's tracker (never commit that file)
- Local Postgres: `docker compose up -d` (`postgresql://postgres:jobradar@localhost:5432/jobradar`). Copy `.env.example` to `.env.local`.

## Environments

- **Development**: tracks the `development` branch (Vercel preview deployment, Clerk development keys).
- **Production**: https://jobs.ciuculescu.com, tracks the `main` branch (Clerk production instance).
- Local runs use `.env.local`; do not load its credentials from tooling without the user's say-so.

## Architecture

Personal job dashboard: Next.js App Router (`app/`) + Drizzle/Neon Postgres (`src/db`) + Clerk auth/Billing. Shared code lives in `src/` (alias `@/*` → `src/*`); UI components in `components/`.

- **Fetch pipeline** (`src/lib/sources/`): each source implements `JobSource` (`job-source.ts`) and is listed in `registry.ts`. `pipeline.ts#runFetchPipeline` runs sources independently (one failure doesn't stop others), writes per-source status to `sourceHealth`, persists via `repository/jobs.ts` (normalize → dedupe → score), then runs optional AI analysis. Only sources with an official public API/feed that permits this use may be enabled; no CAPTCHA/login/anti-bot evasion.
- **Scoring** (`src/lib/scoring/scorer.ts`): rules-based tiers (backend → PHP+Laravel → strong match requiring full remote + salary ≥ configured minimum). Scores are per user. AI analysis is optional, off by default, Pro-only.
- **Scheduled runs**: `.github/workflows/fetch-jobs.yml` runs `jobs:fetch` then `notifications:send` twice daily (secrets: `DATABASE_URL`, AI_*, EMAIL_*). Scripts in `scripts/` are standalone tsx entry points.
- **Auth** (`proxy.ts`, `src/lib/app-user.ts`): `clerkMiddleware()` is deliberately non-protecting so anonymous users can browse. Writes must call `requireAppUser()`; paid features gate via `hasPaidFeature()` (owner gets a Pro override). Admin/owner are determined by verified emails in `APP_ADMIN_EMAILS` / `APP_OWNER_EMAIL`. Clerk users sync into the `users` table (`clerk-sync.ts`, webhook at `app/api/webhooks/clerk`).
- **Demo mode**: without `DATABASE_URL`, `db` is null and the UI uses `src/lib/demo-jobs.ts` read-only; code must handle `db` being null.
- `/network` is a private per-user tracker; its data must never be added to repo fixtures.

See `README.md` (setup/deploy), `PLAN.md` (feature status), `docs/CLERK_SETUP.md`.
