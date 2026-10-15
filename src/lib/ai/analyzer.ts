import { and, count, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { aiAnalyses, jobs, userJobScores } from "@/db/schema";
import { eligibleAiUserIds } from "@/lib/ai/access";
import { AiRefusalError } from "@/lib/ai/client";
import { aiConfig, analysisEnabled } from "@/lib/ai/config";
import { analyzeJobFit } from "@/lib/ai/fit";
import { runPool } from "@/lib/ai/pool";
import { profileHash } from "@/lib/ai/profile-hash";
import { AiBudgetError } from "@/lib/ai/usage";
import { getScoringProfile } from "@/lib/repository/jobs";
import type { ScoringProfile } from "@/lib/types";

async function analyzeAndStore(userId: string, profile: ScoringProfile, hash: string, job: typeof jobs.$inferSelect, rulesScore: number, model: string, effort: "low" | "medium") {
  if (!db) throw new Error("Database is not configured");
  const startedAt = Date.now();
  const { analysis, usage, costMicroUsd, model: usedModel, promptVersion } = await analyzeJobFit(userId, profile, job, rulesScore, { model, effort });
  const values = {
    score: analysis.score, recommendation: analysis.recommendation, summary: analysis.summary, matches: analysis.matches, gaps: analysis.gaps,
    concerns: analysis.concerns, talkingPoints: analysis.talking_points, estimatedFit: analysis.estimated_fit, model: usedModel, promptVersion,
    profileHash: hash, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens, costUsdMicros: costMicroUsd, analyzedAt: new Date(),
  };
  await db.insert(aiAnalyses).values({ userId, jobId: job.id, ...values }).onConflictDoUpdate({ target: [aiAnalyses.userId, aiAnalyses.jobId], set: values });
  console.info(JSON.stringify({ event: "ai.analysis", userId, jobId: job.id, model: usedModel, promptVersion, durationMs: Date.now() - startedAt, ...usage, costMicroUsd }));
}

async function analysesToday(userId: string) {
  if (!db) return 0;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [row] = await db.select({ value: count() }).from(aiAnalyses).where(and(eq(aiAnalyses.userId, userId), gte(aiAnalyses.analyzedAt, startOfDay)));
  return row?.value ?? 0;
}

export type AnalyzeJobResult = { status: "ok" | "cached" } | { status: "error"; error: string };

// On-demand analysis for one job. Callers must check authentication and the Pro entitlement first.
// An analysis computed for the user's current profile is reused; a changed profile triggers a fresh one.
export async function analyzeJobForUser(userId: string, jobId: string): Promise<AnalyzeJobResult> {
  if (!db) return { status: "error", error: "Demo mode is read-only." };
  if (!analysisEnabled()) return { status: "error", error: "AI analysis is not configured on this server." };
  const profile = await getScoringProfile(userId);
  const hash = profileHash(profile);
  const [existing] = await db.select({ hash: aiAnalyses.profileHash }).from(aiAnalyses).where(and(eq(aiAnalyses.userId, userId), eq(aiAnalyses.jobId, jobId))).limit(1);
  if (existing && existing.hash === hash) return { status: "cached" };
  const limit = aiConfig.dailyAnalysisLimit;
  if (await analysesToday(userId) >= limit) return { status: "error", error: `Daily limit of ${limit} AI analyses reached. Try again tomorrow.` };
  const [row] = await db.select({ job: jobs, score: userJobScores.score }).from(jobs).leftJoin(userJobScores, and(eq(userJobScores.jobId, jobs.id), eq(userJobScores.userId, userId))).where(eq(jobs.id, jobId)).limit(1);
  if (!row) return { status: "error", error: "Job not found." };
  try {
    await analyzeAndStore(userId, profile, hash, row.job, row.score ?? row.job.score, aiConfig.analysisModel, "low");
    return { status: "ok" };
  } catch (error) {
    console.error(JSON.stringify({ event: "ai.analysis_failed", userId, jobId, error: error instanceof Error ? error.message : "unknown" }));
    if (error instanceof AiBudgetError) return { status: "error", error: error.message };
    return { status: "error", error: error instanceof AiRefusalError ? "The model declined to analyze this listing." : "AI analysis failed. Please try again later." };
  }
}

/**
 * Scheduled second-opinion pass for eligible users. Covers borderline jobs (from the "maybe" threshold up), skips results
 * already computed for the user's current profile, and re-analyzes when the profile has changed. Uses the cheaper bulk model.
 */
export async function analyzeRelevantJobs() {
  if (!db || !analysisEnabled()) return 0;
  let analyzed = 0;
  let budgetExhausted = false;
  for (const userId of await eligibleAiUserIds()) {
    if (budgetExhausted) break;
    const profile = await getScoringProfile(userId);
    const hash = profileHash(profile);
    const candidates = await db.select({ job: jobs, match: userJobScores }).from(userJobScores).innerJoin(jobs, eq(jobs.id, userJobScores.jobId))
      .where(and(eq(userJobScores.userId, userId), gte(userJobScores.score, profile.thresholds.maybe))).orderBy(desc(userJobScores.score)).limit(300);
    const done = new Map((await db.select({ jobId: aiAnalyses.jobId, hash: aiAnalyses.profileHash }).from(aiAnalyses).where(eq(aiAnalyses.userId, userId))).map((row) => [row.jobId, row.hash]));
    const pending = candidates.filter(({ job }) => done.get(job.id) !== hash).slice(0, aiConfig.maxJobsPerUserRun);
    await runPool(pending, aiConfig.concurrency, async ({ job, match }) => {
      if (budgetExhausted) return;
      try {
        await analyzeAndStore(userId, profile, hash, job, match.score, aiConfig.bulkModel, "low");
        analyzed++;
      } catch (error) {
        if (error instanceof AiBudgetError && error.reason === "global_budget") budgetExhausted = true;
        console.error(JSON.stringify({ event: "ai.analysis_failed", userId, jobId: job.id, error: error instanceof Error ? error.message : "unknown" }));
      }
    });
  }
  return analyzed;
}
