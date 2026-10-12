# AI helper and scoring plan

Status: scaffolded on branch `feature/ai-profile-copilot`. This document records the analysis, the options considered, the decision reached, the budget model, and the development targets. It is the reference for the AI work; `PLAN.md` carries the checklist.

## 1. Starting point (audit of the codebase)

Findings that drive the decision:

- **AI was a batch afterthought.** `analyzeRelevantJobs()` ran in the GitHub Actions fetch job, for at most 30 jobs per Pro user per run, with sequential calls through a raw OpenAI-compatible `fetch`.
- **AI only saw jobs the rules already liked** (score at or above `thresholds.review`), so it could never rescue a good job the regexes under-scored.
- **Analyses were never refreshed.** `ai_analyses` rows were insert-once; editing the profile left them stale.
- **AI output was separate from ranking.** It appeared only in the job-detail sidebar and never affected the dashboard order or alerts.
- **The scorer was hard-coded to one profile.** `scorer.ts` had fixed backend/PHP/Laravel tiers (`tier.php_laravel_backend`), a `strongWeightBySkill` table with PHP-biased defaults, and Romania/Europe location points. For any other registered user the "Review" and "Apply" ladder was meaningless.
- **Profile setup was manual**: comma-separated lists plus a raw JSON weights field.
- **Scoring cost scaled badly**: every job was scored for every user, re-reading each profile per job.
- Pro gating (`hasPaidFeature("ai_analysis")`, `ownerPro`) and per-user storage already existed and were reused.

## 2. Options considered

| | A: second-opinion layer | B: profile copilot + rubric | C: hybrid pipeline |
|---|---|---|---|
| What | Upgrade the batch analyzer: blend AI with rules, re-analyze on profile change, on-demand button, cover borderline jobs | AI turns a CV into a structured profile and a per-user scoring rubric once; deterministic scorer becomes data-driven; AI explains and tunes scores | One shared LLM extraction per job into `job_facts`; embeddings pre-rank; LLM re-ranks top K; application assistant |
| Fixes the PHP-only scorer | No | **Yes** | Partly |
| Better per-job accuracy | Some | No | Yes |
| Cost at scale | users × jobs | about zero | jobs + users × K |
| Effort | 2–3 days | 1–1.5 weeks | 3–4 weeks |
| Risk | Low | Medium | High |

## 3. Decision

**Build B first, then fold in A's freshness and blending, then C's shared job-fact extraction only if scoring quality still needs it.** B is the only option that makes the product work for registered users who are not the owner, and it adds almost no ongoing AI cost, which matches the $0-ceiling philosophy of the project.

Principles:

1. **Scoring stays deterministic.** AI produces a *rubric* (data), not scores. Scores stay cheap, testable and explainable. Rules scoring works with no AI configured.
2. **AI output is a draft.** Profile and rubric drafts are validated with zod, shown to the user, and saved only on explicit accept.
3. **Cheap model for bulk, capable model for one-off.** Per-user one-off work (profile/rubric draft, score explanation) uses `claude-sonnet-5-5`. Per-job bulk work uses `claude-haiku-5-5`. Both are env-configurable.
4. **Every call is metered** (`ai_usage`) and checked against a per-user monthly call cap and a global monthly USD cap before it runs.
5. **Job descriptions are untrusted data.** Output is schema-validated; model output can never change permissions, billing or the database outside its own validated fields.
6. **CV text is not stored.** It is sent to the model once, with explicit consent, and only the resulting draft is persisted.

## 4. Budget and user target

Assumptions: €500 test budget over 6 months (about €83, roughly $90, per month); list prices cached 2026-10-06 (Sonnet 5.5 $2/$10 per million input/output tokens; Haiku 5.5 $0.10/$0.50); per-job analysis of about 300 jobs per user per month (assumed).

| Workload | Model | Cost per active user per month |
|---|---|---|
| Profile + rubric draft (about 4K in, 6K out incl. thinking) | Sonnet 5.5 | $0.10–0.20, once |
| About 15 score explanations / tuning calls | Sonnet 5.5 | about $0.25 |
| Per-job analysis, about 300 jobs | Haiku 5.5 | about $0.20 |
| Per-job analysis, about 300 jobs | Sonnet 5.5 | about $3–5 (breaks the budget) |

B plus Haiku per-job analysis is about $0.5–0.7 per user per month; with 30% held back for development and evals, $60 supports roughly 100 users.

**Target: 30–50 active beta users, hard cap about 100.** The limit is not cost but learning value:

- Role variety: at least about 5 users in each of 5–6 stacks (Python, JS/TS, Java, .NET, DevOps, PHP) to test whether generated rubrics work beyond the owner's profile.
- Job sources (Himalayas, We Work Remotely, Jobgether) mostly cover remote developer roles, so recruit developers only.
- Spend roughly €50–80 of the budget on an eval set: users rate about 30 jobs each; compare AI/rubric scores to their ratings.

Guardrails (implemented in `src/lib/ai/usage.ts`): monthly per-user call cap per interactive feature (`AI_MONTHLY_CALL_CAP`, default 40; bulk job work is bounded per run by `AI_MAX_JOBS_PER_USER_RUN`), global monthly budget (`AI_MONTHLY_BUDGET_USD`, default 60), usage logged on every call. Also set a spend limit on a dedicated Anthropic workspace and confirm the credit offer applies to API usage.

## 5. Architecture

```
CV text ──► profile-copilot (Sonnet 5.5, structured output)
              │  validated + normalized draft ─► ai_profile_drafts ─► user reviews ─► candidate_profiles (+ rubric)
              ▼
job ──► scoreJob(job, profile)  ── rubric present? ─ yes ► data-driven tiers (role families, must-have skills)
                                                    └ no  ► legacy PHP/Laravel tiers (unchanged)
              │
              ├─► score-explainer (Sonnet 5.5): "why 62?" + weight suggestions validated against the breakdown
              ├─► analyzer (Haiku 5.5, per job): second opinion, profile-hash freshness, borderline coverage
              └─► job-facts (Haiku 5.5, once per job, shared by all users; flag-gated, not yet wired into the pipeline)
```

Provider: the official Anthropic SDK (`@anthropic-ai/sdk`) with structured outputs (`output_config.format` via `zodOutputFormat`). This replaces the previous OpenAI-compatible `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` settings with `ANTHROPIC_API_KEY`, `AI_MODEL_PROFILE` and `AI_MODEL_BULK`. Model notes: Sonnet 5.5 cannot disable thinking and rejects forced `tool_choice`, so thinking is left at its default with `effort` set per call; Haiku 5.5 rejects non-default sampling parameters, so none are sent.

## 6. Roadmap and acceptance criteria

### Phase AI-1: profile copilot and rubric scoring (Option B)
- [x] Scaffold: schema + migration `0005_ai_copilot.sql`, Anthropic client with metering, rubric types, rubric-aware scorer, copilot, explainer, settings UI and server actions
- [ ] Apply migration 0005 to Neon; set `ANTHROPIC_API_KEY`
- [ ] Prompt iteration against 10+ real CVs across stacks; review drafts by hand
- [ ] Admin control to toggle `users.ai_beta` (currently SQL only)
- [ ] Eval set: users rate about 30 jobs each; report rule/rubric score vs ratings

**Acceptance:** a Python, JS or Java developer pastes a CV, edits and accepts the draft, and sees sensible Review/Apply tiers on their dashboard without touching JSON weights; legacy profiles without a rubric score exactly as before; every AI call appears in `ai_usage` and respects the caps.

### Phase AI-2: second-opinion layer (Option A)
- [x] Scaffold: analyzer moved to Anthropic SDK + Haiku, profile-hash freshness, borderline coverage, bounded concurrency, budget checks; pure `blendScores`
- [ ] Wire blended score into dashboard ordering behind `AI_BLEND_WEIGHT` (default 0 = off)
- [ ] "Analyze now" button on the job page with a per-user daily cap
- [ ] AI badge and matches/gaps on dashboard rows

**Acceptance:** editing a profile triggers re-analysis on the next run; AI can surface borderline jobs the rules under-scored; blending is off by default and reversible.

### Phase AI-3: shared job facts (Option C, conditional)
- [x] Scaffold: `job_facts` table and `extractJobFacts()` behind `AI_JOB_FACTS_ENABLED` (not called by the pipeline)
- [ ] Decide after AI-1/AI-2 measurements whether regex extraction of remote policy, salary and seniority is the quality bottleneck
- [ ] If yes: wire extraction into `persistJobs`, feed facts to the scorer, evaluate pgvector pre-ranking and an application assistant

**Acceptance:** scoring accuracy improves measurably on the eval set at a per-job cost that stays flat as users grow.

## 7. Open questions

- Which stacks and how many invited testers per stack?
- Do beta users get AI through the Pro plan or through the `ai_beta` flag only?
- Is the credit offer valid for API usage in a dedicated workspace?
- EU data handling: consent copy for sending CV text to a third-party model, and whether to offer deletion of drafts.
