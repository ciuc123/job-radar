# AI fit analysis — rollout checklist

Companion to [`AI_MVP_PLAN.md`](AI_MVP_PLAN.md). Tick items as you go. Console page paths may move; if a link 404s, use the Console menu.

## 1. Anthropic Console
- [x] Sign in and redeem the €1k credits: https://platform.claude.com/settings/billing
- [x] Create a `job-radar` workspace: https://platform.claude.com/settings/workspaces
- [x] Set a monthly spend limit on it (e.g. $50): https://platform.claude.com/settings/limits
- [x] Create API keys `job-radar-dev` and `job-radar-prod` in that workspace: https://platform.claude.com/settings/keys

## 2. Local
- [x] In the worktree's `.env` (or `.env.local`) set `AI_ANALYSIS_ENABLED=true`, `ANTHROPIC_API_KEY=<dev key>` and `AI_MODEL=claude-opus-5-5`. Env files are git-ignored, so each worktree needs its own copy.
- [x] Point `DATABASE_URL` at a **Neon** database. `src/db` uses the `neon-http` driver, so the local Docker Postgres does not work; create a throwaway branch at https://console.neon.tech → Branches. Then run `npm run db:migrate && npm run dev`, open http://localhost:3000, open a job and click **Analyze fit**
- [x] Reload the page and confirm the result is reused (no new `ai.analysis` log line)
- [x] Run `npm run ai:eval`: 15/15 on `claude-opus-5-5`, $0.19 total (2026-10-13)
- [ ] Optional: run `AI_MODEL=claude-haiku-5-5 npm run ai:eval` and compare agreement and cost
- [ ] Check spend: https://platform.claude.com/usage

## 3. Clerk
- [x] Confirm the Pro plan includes the feature `ai_analysis` (Billing → Plans): https://dashboard.clerk.com

## 4. Database (before deploying, or the job page breaks)
- [ ] Run `npm run db:migrate` against the Preview `DATABASE_URL`: https://console.neon.tech
- [ ] Run `npm run db:migrate` against the Production `DATABASE_URL`

## 5. Vercel: Project → Settings → Environment Variables (https://vercel.com/dashboard)
- [x] `ANTHROPIC_API_KEY`: the dev key for **Preview**, the prod key for **Production**
- [x] `AI_ANALYSIS_ENABLED=true`, `AI_MODEL=claude-opus-5-5` (Development)
- [x] `AI_ANALYSIS_ENABLED=true`, `AI_MODEL=claude-opus-5-5`, `AI_DAILY_LIMIT=20` (Preview)
- [x] `AI_ANALYSIS_ENABLED=true`, `AI_MODEL=claude-opus-5-5`, `AI_DAILY_LIMIT=20` (Production)
- [x] Delete `AI_BASE_URL` and `AI_API_KEY` if present

## 6. GitHub Actions: https://github.com/ciuc123/job-radar/settings/secrets/actions
- [ ] Add `ANTHROPIC_API_KEY` (prod key) and set `AI_ANALYSIS_ENABLED=true`
- [ ] Optional: add `AI_BATCH_LIMIT=10` so the scheduled run pre-analyzes each Pro user's top matches (default 0 = on demand only)
- [ ] Delete `AI_BASE_URL` and `AI_API_KEY`
- [ ] Trigger the workflow once by hand and check the log for `ai.analysis`: https://github.com/ciuc123/job-radar/actions/workflows/fetch-jobs.yml

## 7. Ship
- [ ] Push `worktree-ai-mvp` and open a PR into `development`: https://github.com/ciuc123/job-radar/compare/development...worktree-ai-mvp
- [ ] Test on the Vercel Preview URL
- [ ] Merge `development` → `main`, then check https://jobs.ciuculescu.com/admin ("AI usage this month")
- [ ] Compare the `/admin` estimate with Console usage: https://platform.claude.com/usage

## 8. Interview prep
- [ ] [`AI_MVP_PLAN.md`](AI_MVP_PLAN.md) §4 "Interview talking points"
- [ ] Structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- [ ] Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- [ ] Batch processing (v2): https://platform.claude.com/docs/en/build-with-claude/batch-processing
- [ ] Pricing: https://platform.claude.com/docs/en/about-claude/pricing
