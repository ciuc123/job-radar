import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiAnalyses, jobs, userJobScores, users } from "@/db/schema";
import { getScoringProfile } from "@/lib/repository/jobs";

const analysisSchema = z.object({ score: z.number().int().min(0).max(100), recommendation: z.enum(["APPLY", "REVIEW", "MAYBE", "REJECT"]), summary: z.string(), matches: z.array(z.string()), gaps: z.array(z.string()), concerns: z.array(z.string()), estimated_fit: z.enum(["excellent", "good", "fair", "poor"]) });

export async function analyzeRelevantJobs() {
  if (!db || process.env.AI_ANALYSIS_ENABLED !== "true" || !process.env.AI_BASE_URL || !process.env.AI_API_KEY || !process.env.AI_MODEL) return 0;
  const eligible = await db.select({ userId: users.id }).from(users).where(and(eq(users.ownerPro, false), eq(users.subscriptionPlan, "pro"), eq(users.subscriptionStatus, "active")));
  const owners = await db.select({ userId: users.id }).from(users).where(eq(users.ownerPro, true));
  let analyzed = 0;
  for (const { userId } of [...eligible, ...owners]) {
    const profile = await getScoringProfile(userId);
    const pending = await db.select({ job: jobs, match: userJobScores }).from(userJobScores).innerJoin(jobs, eq(jobs.id, userJobScores.jobId)).where(and(eq(userJobScores.userId, userId), gte(userJobScores.score, profile.thresholds.review))).orderBy(desc(userJobScores.score)).limit(30);
    const existing = new Set((await db.select({ jobId: aiAnalyses.jobId }).from(aiAnalyses).where(eq(aiAnalyses.userId, userId))).map((row) => row.jobId));
    for (const { job, match } of pending) {
      if (existing.has(job.id)) continue;
      try {
        const response = await fetch(`${process.env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${process.env.AI_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ model: process.env.AI_MODEL, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Analyze fit using only explicit facts in the candidate profile and job listing. Do not infer unstated requirements. Return only JSON with score (integer 0-100), recommendation (APPLY|REVIEW|MAYBE|REJECT), summary, matches, gaps, concerns, estimated_fit (excellent|good|fair|poor)." }, { role: "user", content: JSON.stringify({ candidate: profile, deterministicScore: match.score, job: { title: job.title, company: job.company, location: job.location, technologies: job.technologies, description: job.description } }) }] }), signal: AbortSignal.timeout(30_000) });
        if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
        const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const parsed = analysisSchema.parse(JSON.parse(body.choices?.[0]?.message?.content ?? ""));
        await db.insert(aiAnalyses).values({ userId, jobId: job.id, score: parsed.score, recommendation: parsed.recommendation, summary: parsed.summary, matches: parsed.matches, gaps: parsed.gaps, concerns: parsed.concerns, estimatedFit: parsed.estimated_fit, model: process.env.AI_MODEL }).onConflictDoNothing();
        analyzed++;
      } catch (error) { console.error(JSON.stringify({ event: "ai.analysis_failed", userId, jobId: job.id, error: error instanceof Error ? error.message : "unknown" })); }
    }
  }
  return analyzed;
}
