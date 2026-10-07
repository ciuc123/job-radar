# Job Radar

A private, personal dashboard that finds remote developer roles, scores them against an editable profile, and leaves every application decision to you.

## Stack

- Next.js + TypeScript on Vercel Hobby
- Neon Postgres through the serverless driver
- Drizzle ORM and migrations
- Google OAuth via Auth.js
- Public-repository GitHub Actions for scheduled fetching

The app does not auto-apply. “Apply” always opens the original job page. AI analysis and email delivery are optional and off unless configured. Free plans have changing quotas; do not enable paid overages if maintaining a $0 ceiling matters.

## Local setup

1. Install Node.js 22+ and run `npm install`.
2. Copy `.env.example` to `.env.local` and fill in Neon and Google OAuth values.
3. Set the Google OAuth redirect URI to `${APP_URL}/api/auth/callback/google`.
4. Run `npm run db:migrate` and `npm run db:seed`.
5. Run `npm run dev` and open `http://localhost:3000`.

Without database credentials, the UI uses sample jobs in read-only demo mode. Mutating actions require a configured database and authenticated user.

## Deploy

Create a Neon Postgres project and a Vercel project connected to the public GitHub repository. Set the variables from `.env.example` in Vercel. Run migrations using `npm run db:migrate` with the production `DATABASE_URL` before enabling the app. Add the same database and cron secret to GitHub repository Actions secrets. The scheduled workflow runs once each morning UTC; it can also be triggered manually from Actions.

Google sign-in requires OAuth client credentials. Restrict the OAuth consent audience and authorized users to your own account. Never commit `.env.local`, provider secrets, or Neon URLs.

## Source availability

Sources are enabled only when they expose an official public API/feed and their terms permit this personal use. Himalayas is supported through its documented public API. Laravel News is configured through its public jobs feed when available; failed/unavailable sources remain visible in health logs. Remotive is disabled because its published terms restrict automated extraction and syndication absent permission. No source uses CAPTCHA, login automation, or anti-bot evasion.

See [PLAN.md](./PLAN.md) for feature status and acceptance criteria.
