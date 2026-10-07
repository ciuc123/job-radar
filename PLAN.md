# Job Radar implementation tracker

## Phase 1 — Core MVP

- [x] Next.js app scaffold, Vercel configuration, environment template, and setup guide
- [x] Neon Postgres schema and persistence for profile, jobs, source links, and settings
- [x] Google sign-in and private dashboard access
- [x] Editable candidate profile and deterministic scoring configuration
- [x] Source adapter contract with Himalayas and Laravel News; unavailable-source health states
- [x] Normalization, canonical URL/title/content deduplication, and source URL aggregation
- [x] Deterministic 0–100 scoring and recommendation thresholds
- [x] Dashboard search/filters, job detail, external Apply, Save, Reject, notes, and seed data
- [x] Phase 1 test suite (normalization, dedupe, scoring, negatives, location, salary, source failures, thresholds)

**Phase 1 acceptance:** the application runs locally and deploys to Vercel with Neon; 20+ realistic fixtures rank strong matches above poor matches; a user can inspect a fetched or seeded job and open its original URL. Run and pass the full Phase 1 suite before beginning Phase 2.

## Phase 2 — Coverage and operations

- [x] Add verified We Work Remotely public RSS source; mark unverified/restricted endpoints unavailable
- [x] Optional AI analysis with stored results and no required paid API (OpenAI-compatible endpoint; disabled by default)
- [x] Daily email digest and configurable score threshold notifications
- [x] Scheduled source fetching through GitHub Actions, with independent source failures
- [x] Source health and fetch execution logs

**Phase 2 acceptance:** scheduled fetches normalize, deduplicate, score, optionally analyze, and notify; source errors are isolated and visible.

## Phase 3 — Application tracking

- [x] Private recruiter/platform pipeline, statuses, cadence, next action, and notes
- [ ] Application pipeline and status history
- [ ] Interview dates, notes, CV/cover-letter references, salary expectations, contacts, next actions
- [ ] Lightweight personal application analytics

**Phase 3 acceptance:** human review remains required; user can mark a job applied and track it through offer/rejection/withdrawal without submitting applications automatically.

## Commit discipline

Commit each completed feature independently. Keep this checklist updated in the same feature commit. Never commit credentials or `.env` files.

## Deployment cost assumptions

Use Vercel Hobby, Neon Free, public-repository GitHub Actions, and optional free-tier email. Disable paid AI by default. Provider quotas and free-plan terms can change; core discovery, scoring, and manual application review must work without paid integrations.
