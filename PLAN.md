# Job Radar implementation tracker

## Phase 1 — Core MVP

- [x] Next.js app scaffold, Vercel configuration, environment template, and setup guide
- [x] Neon Postgres schema and persistence for profile, jobs, source links, and settings
- [x] Google sign-in and private dashboard access
- [x] Editable candidate profile and deterministic scoring configuration
- [x] Source adapter contract with Himalayas and Laravel News; unavailable-source health states
- [x] Normalization, canonical URL/title/content deduplication, and source URL aggregation
- [x] Deterministic 0–100 scoring and recommendation thresholds
- [x] Backend-first scoring tiers: backend pipeline, PHP/Laravel review, and salary-qualified full-remote strong match
- [x] Dashboard search/filters, job detail, external Apply, Save, Reject, notes, and seed data
- [x] Phase 1 test suite (normalization, dedupe, scoring, negatives, location, salary, source failures, thresholds)

**Phase 1 acceptance:** the application runs locally and deploys to Vercel with Neon; 20+ realistic fixtures rank strong matches above poor matches; a user can inspect a fetched or seeded job and open its original URL. Run and pass the full Phase 1 suite before beginning Phase 2.

## Phase 2 — Coverage and operations

- [x] Add verified We Work Remotely RSS and paginated Jobgether documented public API; show other sources only when a permitted feed is verified
- [x] Optional AI analysis with stored results and no required paid API (OpenAI-compatible endpoint; disabled by default)
- [x] Daily email digest and configurable score threshold notifications
- [x] Scheduled source fetching through GitHub Actions, with independent source failures
- [x] Run scheduled source fetch at 00:00 and 12:00 UTC
- [x] Source health and fetch execution logs

**Phase 2 acceptance:** scheduled fetches normalize, deduplicate, score, optionally analyze, and notify; source errors are isolated and visible.

## Phase 3 — Application tracking

- [x] Private recruiter/platform pipeline, statuses, cadence, next action, and notes
- [x] Private board follow-up import prepared locally; personal notes excluded from git
- [ ] Application pipeline and status history
- [ ] Interview dates, notes, CV/cover-letter references, salary expectations, contacts, next actions
- [ ] Lightweight personal application analytics

**Phase 3 acceptance:** human review remains required; user can mark a job applied and track it through offer/rejection/withdrawal without submitting applications automatically.

## Commit discipline

Commit each completed feature independently. Keep this checklist updated in the same feature commit. Never commit credentials or `.env` files.

## Clerk authentication and paid features

- [x] Clerk sign-in/sign-up, local account mapping, and removal of the Auth.js route
- [x] Verified-email owner/admin allowlist and no-charge owner Pro entitlement
- [x] Per-user job scores and AI analyses while retaining a shared fetched job corpus
- [x] Pro feature enforcement for AI analysis and email alerts, including scheduled email workers
- [x] Clerk Billing pricing page, webhook synchronization, owner account overview, and direct support/request link
- [ ] Configure development and production Clerk instances, Google OAuth, Billing plans/features, Vercel secrets, and Clerk webhook in the provider dashboards
- [ ] Apply migration 0004 to Neon and verify the existing account and data are linked after first Clerk sign-in

**Clerk acceptance:** the existing verified owner account retains owned records and receives admin/Pro access; new users get isolated data and Free access; Pro features are checked server-side and by scheduled workers; webhook events are signature-verified and deduplicated.

## AI helper for registered users (see docs/AI_PLAN.md)

Target: 30–50 active beta developers (hard cap about 100) within a €500 / 6-month test budget; B first, then A, then C only if measurements justify it.

- [x] Plan, options analysis, budget model and user target documented
- [x] Scaffold (Phase AI-1): Anthropic client with metering and monthly caps, AI profile/rubric draft from CV text, rubric-driven scorer tiers, score explainer with validated weight suggestions, settings and job-page UI, migration 0005
- [x] Scaffold (Phase AI-2): analyzer moved to Anthropic Haiku with profile-hash freshness, borderline coverage, bounded concurrency; `blendScores` (off by default)
- [x] Scaffold (Phase AI-3): `job_facts` table and `extractJobFacts` behind a flag, not wired into the pipeline
- [ ] Apply migration 0005, set `ANTHROPIC_API_KEY`, enable `AI_COPILOT_ENABLED`
- [ ] Prompt iteration on 10+ real CVs across stacks; admin control for `users.ai_beta`
- [ ] Eval set from beta users' job ratings; decide whether to wire blending (`AI_BLEND_WEIGHT`) and job facts

**AI acceptance:** a non-PHP developer gets sensible tiers from a reviewed AI draft without editing JSON; legacy profiles score exactly as before; all calls are metered and capped; AI never changes a score unless blending is explicitly enabled.

## Deployment cost assumptions

Use Vercel Hobby, Neon Free, public-repository GitHub Actions, and optional free-tier email. Disable paid AI by default. Provider quotas and free-plan terms can change; core discovery, scoring, and manual application review must work without paid integrations.
