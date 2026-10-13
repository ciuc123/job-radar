import { and, count, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { aiAnalyses, jobs, userJobScores, users } from "@/db/schema";
import { analyzeJobFit, isAiConfigured } from "@/lib/ai/claude";
import { getScoringProfile } from "@/lib/repository/jobs";
import type { ScoringProfile } from "@/lib/types";

const intEnv = (name: string, fallback: number) => {
  // Unset GitHub secrets arrive as empty strings, which Number() would turn into 0.
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
};
export const aiDailyLimit = () => intEnv("AI_DAILY_LIMIT", 20);
// Analyses per Pro user per scheduled fetch run. 0 (default) keeps AI on-demand only.
const aiBatchLimit = () => intEnv("AI_BATCH_LIMIT", 0);

async function analyzeAndStore(userId: string, profile: ScoringProfile, job: typeof jobs.$inferSelect, deterministicScore: number) {
  if (!db) throw new Error("Database is not configured");
  const startedAt = Date.now();
  const { analysis, usage, model, promptVersion } = await analyzeJobFit(profile, job, deterministicScore);
  const [row] = await db.insert(aiAnalyses).values({
    userId, jobId: job.id, score: analysis.score, recommendation: analysis.recommendation, summary: analysis.summary,
    matches: analysis.matches, gaps: analysis.gaps, concerns: analysis.concerns, talkingPoints: analysis.talking_points, estimatedFit: analysis.estimated_fit,
    model, promptVersion, ...usage,
  }).onConflictDoNothing().returning();
  console.info(JSON.stringify({ event: "ai.analysis", userId, jobId: job.id, model, promptVersion, durationMs: Date.now() - startedAt, ...usage }));
  return row;
}

export async function analysesToday(userId: string) {
  if (!db) return 0;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [row] = await db.select({ value: count() }).from(aiAnalyses).where(and(eq(aiAnalyses.userId, userId), gte(aiAnalyses.analyzedAt, startOfDay)));
  return row?.value ?? 0;
}

export type AnalyzeJobResult = { status: "ok" | "cached" } | { status: "error"; error: string };

// On-demand analysis for one job. Callers must check authentication and the Pro entitlement first.
export async function analyzeJobForUser(userId: string, jobId: string): Promise<AnalyzeJobResult> {
  if (!db) return { status: "error", error: "Demo mode is read-only." };
  if (!isAiConfigured()) return { status: "error", error: "AI analysis is not configured on this server." };
  const existing = await db.select({ jobId: aiAnalyses.jobId }).from(aiAnalyses).where(and(eq(aiAnalyses.userId, userId), eq(aiAnalyses.jobId, jobId))).limit(1);
  if (existing[0]) return { status: "cached" };
  const limit = aiDailyLimit();
  if (await analysesToday(userId) >= limit) return { status: "error", error: `Daily limit of ${limit} AI analyses reached. Try again tomorrow.` };
  const [row] = await db.select({ job: jobs, score: userJobScores.score }).from(jobs).leftJoin(userJobScores, and(eq(userJobScores.jobId, jobs.id), eq(userJobScores.userId, userId))).where(eq(jobs.id, jobId)).limit(1);
  if (!row) return { status: "error", error: "Job not found." };
  try {
    await analyzeAndStore(userId, await getScoringProfile(userId), row.job, row.score ?? row.job.score);
    return { status: "ok" };
  } catch (error) {
    console.error(JSON.stringify({ event: "ai.analysis_failed", userId, jobId, error: error instanceof Error ? error.message : "unknown" }));
    return { status: "error", error: error instanceof Error && error.message === "ai_refused" ? "The model declined to analyze this listing." : "AI analysis failed. Please try again later." };
  }
}

// Scheduled path (end of the fetch pipeline): pre-analyze each Pro user's best unanalyzed matches.
export async function analyzeRelevantJobs() {
  const batchLimit = aiBatchLimit();
  if (!db || !isAiConfigured() || batchLimit === 0) return 0;
  const eligible = await db.select({ userId: users.id }).from(users).where(and(eq(users.ownerPro, false), eq(users.subscriptionPlan, "pro"), eq(users.subscriptionStatus, "active")));
  const owners = await db.select({ userId: users.id }).from(users).where(eq(users.ownerPro, true));
  let analyzed = 0;
  for (const { userId } of [...eligible, ...owners]) {
    const profile = await getScoringProfile(userId);
    const pending = await db.select({ job: jobs, match: userJobScores }).from(userJobScores).innerJoin(jobs, eq(jobs.id, userJobScores.jobId)).where(and(eq(userJobScores.userId, userId), gte(userJobScores.score, profile.thresholds.review))).orderBy(desc(userJobScores.score)).limit(50);
    const existing = new Set((await db.select({ jobId: aiAnalyses.jobId }).from(aiAnalyses).where(eq(aiAnalyses.userId, userId))).map((row) => row.jobId));
    let budget = Math.min(batchLimit, Math.max(0, aiDailyLimit() - await analysesToday(userId)));
    for (const { job, match } of pending) {
      if (budget <= 0) break;
      if (existing.has(job.id)) continue;
      budget--;
      try {
        await analyzeAndStore(userId, profile, job, match.score);
        analyzed++;
      } catch (error) { console.error(JSON.stringify({ event: "ai.analysis_failed", userId, jobId: job.id, error: error instanceof Error ? error.message : "unknown" })); }
    }
  }
  return analyzed;
}
