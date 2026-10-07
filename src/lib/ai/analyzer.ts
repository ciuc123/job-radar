import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { aiAnalyses, jobs } from "@/db/schema";
import type { ScoringProfile } from "@/lib/types";

const analysisSchema = z.object({ score: z.number().int().min(0).max(100), recommendation: z.enum(["APPLY", "REVIEW", "MAYBE", "REJECT"]), summary: z.string(), matches: z.array(z.string()), gaps: z.array(z.string()), concerns: z.array(z.string()), estimated_fit: z.enum(["excellent", "good", "fair", "poor"]) });

export async function analyzeRelevantJobs(profile: ScoringProfile) {
  if (!db || process.env.AI_ANALYSIS_ENABLED !== "true" || !process.env.AI_BASE_URL || !process.env.AI_API_KEY || !process.env.AI_MODEL) return 0;
  const pending = await db.select().from(jobs).where(eq(jobs.recommendation, "APPLY")).orderBy(desc(jobs.score)).limit(30);
  const analyzedIds = new Set((await db.select({ jobId: aiAnalyses.jobId }).from(aiAnalyses)).map((row) => row.jobId));
  let analyzed = 0;
  for (const job of pending) {
    if (analyzedIds.has(job.id) || job.score < profile.thresholds.review) continue;
    try {
      const response = await fetch(`${process.env.AI_BASE_URL!.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${process.env.AI_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ model: process.env.AI_MODEL, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Analyze fit using only explicit facts in the candidate profile and job listing. Do not infer unstated requirements. Return only JSON with score (integer 0-100), recommendation (APPLY|REVIEW|MAYBE|REJECT), summary, matches, gaps, concerns, estimated_fit (excellent|good|fair|poor)." }, { role: "user", content: JSON.stringify({ candidate: profile, job: { title: job.title, company: job.company, location: job.location, technologies: job.technologies, description: job.description } }) }] }), signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
      const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const parsed = analysisSchema.parse(JSON.parse(body.choices?.[0]?.message?.content ?? ""));
      await db.insert(aiAnalyses).values({ jobId: job.id, score: parsed.score, recommendation: parsed.recommendation, summary: parsed.summary, matches: parsed.matches, gaps: parsed.gaps, concerns: parsed.concerns, estimatedFit: parsed.estimated_fit, model: process.env.AI_MODEL }).onConflictDoNothing();
      analyzed++;
    } catch (error) { console.error(JSON.stringify({ event: "ai.analysis_failed", jobId: job.id, error: error instanceof Error ? error.message : "unknown" })); }
  }
  return analyzed;
}
